// ============================================================
// Ollama API Proxy — Server-side relay to bypass CORS
// Supports: Local, Remote, and Ollama Cloud (ollama.com)
// Routes: /api/ollama/*
// ============================================================

import type { Express, Request, Response } from 'express';

const OLLAMA_CLOUD_URL = 'https://ollama.com';
const DEFAULT_TIMEOUT = 120_000; // 2 minutes for long model responses

/**
 * Register Ollama proxy routes on the Express app.
 * All routes are under /api/ollama/ and relay to the target Ollama server.
 *
 * The frontend sends:
 *   - x-ollama-url: base URL of the Ollama server (or 'cloud' for ollama.com)
 *   - x-ollama-key: API key (optional, for cloud or authenticated servers)
 */
export function registerOllamaProxy(app: Express) {
  // Health check / list models
  app.get('/api/ollama/tags', async (req: Request, res: Response) => {
    try {
      const { baseUrl, headers } = resolveTarget(req);
      const response = await fetch(`${baseUrl}/api/tags`, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        res.status(response.status).json({
          error: `Ollama returned ${response.status}`,
          details: text,
        });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      handleProxyError(err, res);
    }
  });

  // Chat endpoint (non-streaming)
  app.post('/api/ollama/chat', async (req: Request, res: Response) => {
    try {
      const { baseUrl, headers } = resolveTarget(req);
      const body = { ...req.body, stream: false };

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        res.status(response.status).json({
          error: `Ollama returned ${response.status}`,
          details: text,
        });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      handleProxyError(err, res);
    }
  });

  // Chat endpoint (streaming via SSE)
  app.post('/api/ollama/chat/stream', async (req: Request, res: Response) => {
    try {
      const { baseUrl, headers } = resolveTarget(req);
      const body = { ...req.body, stream: true };

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        res.status(response.status).json({
          error: `Ollama returned ${response.status}`,
          details: text,
        });
        return;
      }

      // Stream the response as newline-delimited JSON
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      if (!response.body) {
        res.status(500).json({ error: 'No response body from Ollama' });
        return;
      }

      try {
        // Use Web Streams API (Node 18+ supports this on fetch response bodies)
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
        reader.releaseLock();
      } catch (err) {
        // Fallback: try async iteration (Node.js ReadableStream)
        try {
          for await (const chunk of response.body as any) {
            res.write(typeof chunk === 'string' ? chunk : Buffer.from(chunk));
          }
        } catch {
          // Client disconnected or upstream error — just end
        }
      } finally {
        res.end();
      }
    } catch (err) {
      if (!res.headersSent) {
        handleProxyError(err, res);
      }
    }
  });

  // Server config — tells the frontend if a server-side API key is configured
  app.get('/api/ollama/config', (_req: Request, res: Response) => {
    const keyId = process.env.OLLAMA_KEY_ID || '';
    const keySecret = process.env.OLLAMA_KEY_SECRET || '';
    const hasKey = (keyId && keySecret) || (process.env.OLLAMA_API_KEY || '').length > 10;
    res.json({
      hasServerKey: hasKey,
      defaultMode: hasKey ? 'cloud' : 'local',
    });
  });

  // Connection test
  app.get('/api/ollama/health', async (req: Request, res: Response) => {
    try {
      const { baseUrl, headers } = resolveTarget(req);
      const response = await fetch(`${baseUrl}/api/tags`, {
        headers,
        signal: AbortSignal.timeout(8_000),
      });

      res.json({
        connected: response.ok,
        status: response.status,
        url: baseUrl,
      });
    } catch {
      res.json({
        connected: false,
        status: 0,
        url: resolveTarget(req).baseUrl,
      });
    }
  });
}

/**
 * Resolve the target Ollama server URL and auth headers from the request.
 */
function resolveTarget(req: Request): { baseUrl: string; headers: Record<string, string> } {
  const rawUrl = (req.headers['x-ollama-url'] as string) || '';
  const clientKey = (req.headers['x-ollama-key'] as string) || '';

  // Reconstruct the full Ollama API key from two-part env vars
  // (workaround: the env system truncates values at period characters)
  const keyId = process.env.OLLAMA_KEY_ID || '';
  const keySecret = process.env.OLLAMA_KEY_SECRET || '';
  const serverKey = keyId && keySecret ? `${keyId}.${keySecret}` : (process.env.OLLAMA_API_KEY || '');
  const apiKey = clientKey || serverKey;

  let baseUrl: string;
  if (!rawUrl || rawUrl === 'cloud' || rawUrl === OLLAMA_CLOUD_URL) {
    baseUrl = OLLAMA_CLOUD_URL;
  } else {
    baseUrl = rawUrl.replace(/\/$/, '');
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return { baseUrl, headers };
}

/**
 * Handle proxy errors with user-friendly messages.
 */
function handleProxyError(err: unknown, res: Response) {
  const message = err instanceof Error ? err.message : 'Unknown proxy error';

  if (message.includes('timeout') || message.includes('TimeoutError')) {
    res.status(504).json({
      error: 'Connection timed out',
      details: 'Could not reach the Ollama server. Check the server address and make sure it is running.',
    });
  } else if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
    res.status(502).json({
      error: 'Cannot connect to Ollama',
      details: 'The server refused the connection. Make sure Ollama is running and accessible.',
    });
  } else {
    res.status(500).json({
      error: 'Proxy error',
      details: message,
    });
  }
}

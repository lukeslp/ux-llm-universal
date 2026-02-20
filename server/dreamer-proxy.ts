// ============================================================
// Dreamer API Proxy — Multi-provider LLM via dr.eamer.dev
// Routes: /api/providers, /api/dreamer/*
// Keys come from env only — never from client requests
// ============================================================

import type { Express, Request, Response } from 'express';

const DEFAULT_MODELS: Record<string, string[]> = {
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  xai: ['grok-4-0709', 'grok-3', 'grok-3-mini'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  mistral: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
  cohere: ['command-r-plus', 'command-r'],
  perplexity: ['sonar-pro', 'sonar'],
};

const DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic (Claude)',
  xai: 'xAI (Grok)',
  openai: 'OpenAI (GPT)',
  gemini: 'Google Gemini',
  groq: 'Groq',
  mistral: 'Mistral',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
};

export function registerDreamerProxy(app: Express) {
  const dreamerUrl = (process.env.DREAMER_API_URL || 'http://localhost:5200').replace(/\/$/, '');
  const dreamerKey = process.env.DREAMER_API_KEY || '';

  // List available providers — ollama always present, others from dreamer
  app.get('/api/providers', async (_req: Request, res: Response) => {
    const providers: Array<{ id: string; name: string; models: string[]; available: boolean }> = [
      { id: 'ollama', name: 'Ollama', models: [], available: true },
    ];

    if (!dreamerKey) {
      return res.json({ providers });
    }

    try {
      const response = await fetch(`${dreamerUrl}/v1/llm/models`, {
        headers: { 'X-API-Key': dreamerKey },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json() as {
          providers: Record<string, { chat: boolean; streaming: boolean }>;
        };

        for (const [id, caps] of Object.entries(data.providers)) {
          if (caps.chat && caps.streaming && DISPLAY_NAMES[id]) {
            providers.push({
              id,
              name: DISPLAY_NAMES[id],
              models: DEFAULT_MODELS[id] || [],
              available: true,
            });
          }
        }
      }
    } catch {
      // Dreamer unavailable — only ollama returned
    }

    res.json({ providers });
  });

  // Streaming chat routed through dreamer
  app.post('/api/dreamer/chat/stream', async (req: Request, res: Response) => {
    if (!dreamerKey) {
      res.status(503).json({ error: 'No API key configured for this provider' });
      return;
    }

    const { provider, model, messages, temperature, maxTokens, systemPrompt } = req.body;

    if (!provider || !messages) {
      res.status(400).json({ error: 'provider and messages are required' });
      return;
    }

    try {
      // Prepend system prompt if present
      const allMessages = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;

      const body: Record<string, unknown> = {
        provider,
        messages: allMessages,
        stream: true,
      };
      if (model) body.model = model;
      if (temperature !== undefined) body.temperature = temperature;
      if (maxTokens) body.max_tokens = maxTokens;

      const response = await fetch(`${dreamerUrl}/v1/llm/chat`, {
        method: 'POST',
        headers: {
          'X-API-Key': dreamerKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        res.status(response.status).json({
          error: `Provider error (${response.status})`,
          details: text,
        });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      if (!response.body) {
        res.status(500).json({ error: 'No response body from provider' });
        return;
      }

      try {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
        reader.releaseLock();
      } catch {
        try {
          for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
            res.write(typeof chunk === 'string' ? chunk : Buffer.from(chunk));
          }
        } catch { /* Client disconnected */ }
      } finally {
        res.end();
      }
    } catch (err) {
      if (!res.headersSent) {
        const msg = err instanceof Error ? err.message : 'Unknown proxy error';
        res.status(500).json({ error: msg });
      }
    }
  });
}

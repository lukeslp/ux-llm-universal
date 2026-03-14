// ============================================================
// Manus AI Proxy — Task-based async agent API
// Routes: /api/manus/tasks, /api/manus/tasks/:id, /api/manus/files
// Auth: API_KEY header (NOT Bearer)
// Manus is a task-based agent — NOT a chat/completions API
// ============================================================

import type { Express, Request, Response } from 'express';

const MANUS_BASE = 'https://api.manus.im';

function getManusKey(): string {
  return process.env.MANUS_API_KEY || '';
}

function manusHeaders(): Record<string, string> {
  return {
    'API_KEY': getManusKey(),
    'Content-Type': 'application/json',
  };
}

export function registerManusProxy(app: Express) {
  // Check if Manus is configured
  app.get('/api/manus/status', (_req: Request, res: Response) => {
    const configured = !!getManusKey();
    res.json({ configured, message: configured ? 'Manus API key configured' : 'MANUS_API_KEY not set' });
  });

  // Create a task — POST /api/manus/tasks
  app.post('/api/manus/tasks', async (req: Request, res: Response) => {
    const key = getManusKey();
    if (!key) {
      res.status(503).json({ error: 'MANUS_API_KEY not configured' });
      return;
    }

    try {
      const response = await fetch(`${MANUS_BASE}/v1/tasks`, {
        method: 'POST',
        headers: manusHeaders(),
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(30000),
      });

      const data = await response.json();
      if (!response.ok) {
        res.status(response.status).json({ error: data.error || data.message || `Manus error (${response.status})`, details: data });
        return;
      }
      res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create task';
      res.status(500).json({ error: msg });
    }
  });

  // Get task status — GET /api/manus/tasks/:id
  app.get('/api/manus/tasks/:id', async (req: Request, res: Response) => {
    const key = getManusKey();
    if (!key) {
      res.status(503).json({ error: 'MANUS_API_KEY not configured' });
      return;
    }

    const { id } = req.params;
    try {
      const response = await fetch(`${MANUS_BASE}/v1/tasks/${encodeURIComponent(id)}`, {
        headers: manusHeaders(),
        signal: AbortSignal.timeout(15000),
      });

      const data = await response.json();
      if (!response.ok) {
        res.status(response.status).json({ error: data.error || data.message || `Manus error (${response.status})` });
        return;
      }
      res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch task';
      res.status(500).json({ error: msg });
    }
  });

  // List recent tasks — GET /api/manus/tasks
  app.get('/api/manus/tasks', async (_req: Request, res: Response) => {
    const key = getManusKey();
    if (!key) {
      res.status(503).json({ error: 'MANUS_API_KEY not configured' });
      return;
    }

    try {
      const response = await fetch(`${MANUS_BASE}/v1/tasks`, {
        headers: manusHeaders(),
        signal: AbortSignal.timeout(15000),
      });

      const data = await response.json();
      if (!response.ok) {
        res.status(response.status).json({ error: data.error || data.message || `Manus error (${response.status})` });
        return;
      }
      res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to list tasks';
      res.status(500).json({ error: msg });
    }
  });

  // Cancel a task — POST /api/manus/tasks/:id/cancel
  app.post('/api/manus/tasks/:id/cancel', async (req: Request, res: Response) => {
    const key = getManusKey();
    if (!key) {
      res.status(503).json({ error: 'MANUS_API_KEY not configured' });
      return;
    }

    const { id } = req.params;
    try {
      const response = await fetch(`${MANUS_BASE}/v1/tasks/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        headers: manusHeaders(),
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === 204 || response.status === 200) {
        res.json({ success: true });
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        res.status(response.status).json({ error: data.error || data.message || `Manus error (${response.status})` });
        return;
      }
      res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel task';
      res.status(500).json({ error: msg });
    }
  });

  // Upload file — POST /api/manus/files
  app.post('/api/manus/files', async (req: Request, res: Response) => {
    const key = getManusKey();
    if (!key) {
      res.status(503).json({ error: 'MANUS_API_KEY not configured' });
      return;
    }

    try {
      // Forward raw body as-is (multipart or JSON)
      const contentType = req.headers['content-type'] || 'application/json';
      const response = await fetch(`${MANUS_BASE}/v1/files`, {
        method: 'POST',
        headers: {
          'API_KEY': key,
          'Content-Type': contentType,
        },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(60000),
      });

      const data = await response.json();
      if (!response.ok) {
        res.status(response.status).json({ error: data.error || data.message || `Manus error (${response.status})` });
        return;
      }
      res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload file';
      res.status(500).json({ error: msg });
    }
  });
}

// ============================================================
// Beltalowda Proxy — SSE bridge from beltalowda Flask SocketIO
// Converts SocketIO events to SSE stream for the client
// ============================================================

import type { Express, Request, Response } from 'express';
import { io as SocketIOClient } from 'socket.io-client';

const BELTALOWDA_URL = process.env.BELTALOWDA_URL || 'http://localhost:5009';

export function registerBeltalowdaProxy(app: Express) {
  // Start a research task
  app.post('/api/beltalowda/start', async (req: Request, res: Response) => {
    const { task, provider, model, agents = 5 } = req.body;

    if (!task) {
      res.status(400).json({ error: 'task is required' });
      return;
    }

    try {
      // Connect to beltalowda via SocketIO to submit task
      const socket = SocketIOClient(BELTALOWDA_URL, {
        transports: ['websocket'],
        timeout: 10000,
      });

      const result = await new Promise<{ taskId: string }>((resolve, reject) => {
        const timer = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Task submission timed out'));
        }, 15000);

        socket.on('connect', () => {
          socket.emit('start_task', {
            task,
            provider: provider || 'openai',
            model: model || undefined,
            agents: Math.min(Math.max(1, agents), 30),
          });
        });

        socket.on('task_started', (data: { task_id: string }) => {
          clearTimeout(timer);
          socket.disconnect();
          resolve({ taskId: data.task_id });
        });

        socket.on('task_error', (data: { error: string }) => {
          clearTimeout(timer);
          socket.disconnect();
          reject(new Error(data.error));
        });

        socket.on('connect_error', (err: Error) => {
          clearTimeout(timer);
          reject(new Error(`Cannot connect to beltalowda: ${err.message}`));
        });
      });

      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start research task';
      res.status(500).json({ error: msg });
    }
  });

  // Stream task events via SSE
  app.get('/api/beltalowda/stream/:taskId', (req: Request, res: Response) => {
    const { taskId } = req.params;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const socket = SocketIOClient(BELTALOWDA_URL, {
      transports: ['websocket'],
      timeout: 10000,
    });

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Forward all beltalowda events as SSE
    const EVENTS = [
      'decomposition', 'task_update',
      'belter_start', 'belter_progress', 'belter_complete',
      'drummer_start', 'drummer_progress', 'drummer_complete',
      'camina_start', 'camina_progress', 'camina_stream', 'camina_complete',
      'artifact_ready', 'artifact_list', 'documents_generated',
      'task_complete', 'task_error', 'task_cancelled',
    ];

    for (const event of EVENTS) {
      socket.on(event, (data: unknown) => {
        // Only forward events for this task
        const payload = data as Record<string, unknown>;
        if (payload?.task_id && payload.task_id !== taskId) return;
        sendEvent(event, data);

        // Close connection on terminal events
        if (['task_complete', 'task_error', 'task_cancelled'].includes(event)) {
          sendEvent('done', { taskId });
          socket.disconnect();
          res.end();
        }
      });
    }

    socket.on('connect_error', (err: Error) => {
      sendEvent('error', { error: `Connection failed: ${err.message}` });
      res.end();
    });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 15000);

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      socket.disconnect();
    });
  });

  // List artifacts for a task
  app.get('/api/beltalowda/artifacts/:taskId', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    try {
      const response = await fetch(`${BELTALOWDA_URL}/api/active-tasks`);
      const tasks = await response.json() as Array<{ task_id: string; artifacts?: unknown[] }>;
      const task = tasks.find(t => t.task_id === taskId);
      res.json({ artifacts: task?.artifacts || [] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch artifacts';
      res.status(500).json({ error: msg });
    }
  });

  // Download artifact
  app.get('/api/beltalowda/download/:taskId/*', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const subpath = req.params[0] || 'final-report';
    try {
      const upstream = await fetch(`${BELTALOWDA_URL}/api/download/${taskId}/${subpath}`);
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: 'Download failed' });
        return;
      }
      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      const contentDisposition = upstream.headers.get('content-disposition');
      res.setHeader('Content-Type', contentType);
      if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);

      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      res.status(500).json({ error: msg });
    }
  });
}

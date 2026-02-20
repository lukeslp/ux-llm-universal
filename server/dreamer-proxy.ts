// ============================================================
// Dreamer API Proxy — Multi-provider LLM via dr.eamer.dev
// Routes: /api/providers, /api/dreamer/*
// Keys come from env only — never from client requests
// Provider discovery: env keys drive availability, models fetched live
// ============================================================

import type { Express, Request, Response } from 'express';

// --- Fallback models (used when live fetch fails) ---

const FALLBACK_MODELS: Record<string, string[]> = {
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  xai: ['grok-4-0709', 'grok-3', 'grok-3-mini'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  mistral: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
  cohere: ['command-r-plus', 'command-r'],
  perplexity: ['sonar-pro', 'sonar'],
};

const DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic (Claude)',
  xai: 'xAI (Grok)',
  openai: 'OpenAI (GPT)',
  gemini: 'Google Gemini',
  mistral: 'Mistral',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
};

// --- In-memory cache: 5-minute TTL ---

const modelCache = new Map<string, { models: string[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(provider: string): string[] | null {
  const entry = modelCache.get(provider);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.models;
  return null;
}

function setCache(provider: string, models: string[]) {
  modelCache.set(provider, { models, ts: Date.now() });
}

// --- Per-provider live model fetchers ---

async function fetchAnthropicModels(key: string): Promise<string[]> {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return FALLBACK_MODELS.anthropic;
  const data = await res.json() as { data: { id: string }[] };
  const models = data.data.map(m => m.id).sort();
  return models.length > 0 ? models : FALLBACK_MODELS.anthropic;
}

async function fetchOpenAIModels(key: string): Promise<string[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return FALLBACK_MODELS.openai;
  const data = await res.json() as { data: { id: string }[] };
  const models = data.data
    .map(m => m.id)
    .filter(id => /^(gpt-|o[134])/.test(id))
    .sort();
  return models.length > 0 ? models : FALLBACK_MODELS.openai;
}

async function fetchXAIModels(key: string): Promise<string[]> {
  const res = await fetch('https://api.x.ai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return FALLBACK_MODELS.xai;
  const data = await res.json() as { data: { id: string }[] };
  const models = data.data.map(m => m.id).sort();
  return models.length > 0 ? models : FALLBACK_MODELS.xai;
}

async function fetchGeminiModels(key: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!res.ok) return FALLBACK_MODELS.gemini;
  const data = await res.json() as {
    models: { name: string; supportedGenerationMethods: string[] }[];
  };
  const models = data.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''))
    .sort();
  return models.length > 0 ? models : FALLBACK_MODELS.gemini;
}

async function fetchMistralModels(key: string): Promise<string[]> {
  const res = await fetch('https://api.mistral.ai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return FALLBACK_MODELS.mistral;
  const data = await res.json() as { data: { id: string }[] };
  const models = data.data.map(m => m.id).sort();
  return models.length > 0 ? models : FALLBACK_MODELS.mistral;
}

async function fetchCohereModels(key: string): Promise<string[]> {
  const res = await fetch('https://api.cohere.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return FALLBACK_MODELS.cohere;
  const data = await res.json() as { models: { name: string }[] };
  const models = data.models.map(m => m.name).sort();
  return models.length > 0 ? models : FALLBACK_MODELS.cohere;
}

const MODEL_FETCHERS: Record<string, (key: string) => Promise<string[]>> = {
  anthropic: fetchAnthropicModels,
  openai: fetchOpenAIModels,
  xai: fetchXAIModels,
  gemini: fetchGeminiModels,
  mistral: fetchMistralModels,
  cohere: fetchCohereModels,
};

// --- Fetch models with cache ---

async function getModels(provider: string, key: string): Promise<string[]> {
  const cached = getCached(provider);
  if (cached) return cached;

  const fetcher = MODEL_FETCHERS[provider];
  if (!fetcher) {
    // No live fetcher (e.g. perplexity) — use fallback
    const fallback = FALLBACK_MODELS[provider] || [];
    setCache(provider, fallback);
    return fallback;
  }

  try {
    const models = await fetcher(key);
    setCache(provider, models);
    return models;
  } catch {
    const fallback = FALLBACK_MODELS[provider] || [];
    setCache(provider, fallback);
    return fallback;
  }
}

// --- Provider key map ---

function getProviderKeys(): Record<string, string> {
  return {
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    xai: process.env.XAI_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || '',
    gemini: process.env.GEMINI_API_KEY || '',
    mistral: process.env.MISTRAL_API_KEY || '',
    cohere: process.env.COHERE_API_KEY || '',
    perplexity: process.env.PERPLEXITY_API_KEY || '',
  };
}

// ============================================================

export function registerDreamerProxy(app: Express) {
  const dreamerUrl = (process.env.DREAMER_API_URL || 'http://localhost:5200').replace(/\/$/, '');
  const dreamerKey = process.env.DREAMER_API_KEY || '';

  // List available providers — env keys drive availability, models fetched live
  app.get('/api/providers', async (_req: Request, res: Response) => {
    const providers: Array<{ id: string; name: string; models: string[]; available: boolean }> = [
      { id: 'ollama', name: 'Ollama', models: [], available: true },
    ];

    const keys = getProviderKeys();

    // Fetch models from all configured providers in parallel
    const entries = Object.entries(keys).filter(([, key]) => key.length > 0);
    const results = await Promise.allSettled(
      entries.map(async ([id, key]) => {
        const models = await getModels(id, key);
        return { id, models };
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { id, models } = result.value;
        providers.push({
          id,
          name: DISPLAY_NAMES[id] || id,
          models,
          available: true,
        });
      }
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

// ============================================================
// Dreamer API Proxy — Multi-provider LLM via dr.eamer.dev
// Routes: /api/providers, /api/dreamer/*, /api/tools/*
// Keys come from env only — never from client requests
// Provider discovery: env keys drive availability, models fetched live
// When tools are present: calls provider APIs directly for native tool calling
// ============================================================

import type { Express, Request, Response } from 'express';

// --- Default models per provider (best value Feb 2026) ---

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  xai: 'grok-3-mini',
  openai: 'gpt-4.1-mini',
  gemini: 'gemini-3-flash-preview',
  mistral: 'mistral-small-latest',
  cohere: 'command-r',
  perplexity: 'sonar',
  huggingface: 'Qwen/Qwen3.5-9B',
  manus: 'manus-1.6',
};

// --- Fallback models (used when live fetch fails) ---

const FALLBACK_MODELS: Record<string, string[]> = {
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'],
  xai: ['grok-3-mini', 'grok-3', 'grok-4-0709'],
  openai: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o', 'o4-mini', 'o3'],
  gemini: ['gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview', 'gemini-2.5-flash'],
  mistral: ['mistral-small-latest', 'mistral-large-latest', 'codestral-latest'],
  cohere: ['command-r', 'command-r-plus'],
  perplexity: ['sonar', 'sonar-pro'],
  huggingface: ['Qwen/Qwen3.5-9B', 'meta-llama/Llama-3.1-8B-Instruct', 'deepseek-ai/DeepSeek-R1', 'zai-org/GLM-5'],
  manus: ['manus-1.6', 'manus-1.6-lite', 'manus-1.6-max'],
};

const DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic (Claude)',
  xai: 'xAI (Grok)',
  openai: 'OpenAI (GPT)',
  gemini: 'Google Gemini',
  mistral: 'Mistral',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
  huggingface: 'HuggingFace',
  manus: 'Manus',
};

// --- Provider API endpoints for direct tool-calling ---

const PROVIDER_ENDPOINTS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  xai: 'https://api.x.ai/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
  huggingface: 'https://router.huggingface.co/v1/chat/completions',
  // NOTE: manus is NOT a chat/completions provider — it uses its own task-based API
  // handled separately by manus-proxy.ts
};

// --- In-memory cache: 5-minute TTL ---

const modelCache = new Map<string, { models: string[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

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

async function fetchHuggingFaceModels(key: string): Promise<string[]> {
  const res = await fetch('https://router.huggingface.co/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return FALLBACK_MODELS.huggingface;
  const data = await res.json() as { data: { id: string }[] };
  const models = data.data
    .map(m => m.id)
    .filter(id => !id.includes('embed') && !id.includes('whisper'))
    .sort();
  return models.length > 0 ? models : FALLBACK_MODELS.huggingface;
}

const MODEL_FETCHERS: Record<string, (key: string) => Promise<string[]>> = {
  anthropic: fetchAnthropicModels,
  openai: fetchOpenAIModels,
  xai: fetchXAIModels,
  gemini: fetchGeminiModels,
  mistral: fetchMistralModels,
  cohere: fetchCohereModels,
  huggingface: fetchHuggingFaceModels,
};

async function getModels(provider: string, key: string): Promise<string[]> {
  const cached = getCached(provider);
  if (cached) return cached;

  const fetcher = MODEL_FETCHERS[provider];
  if (!fetcher) {
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
    huggingface: process.env.HF_API_KEY || '',
    manus: process.env.MANUS_API_KEY || '',
  };
}

// ============================================================
// Tool Registry
// ============================================================

interface ToolSchema {
  name: string;
  module: string;
  schema: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: {
        type: string;
        required?: string[];
        properties: Record<string, unknown>;
      };
    };
  };
}

let toolsCache: { tools: ToolSchema[]; ts: number } | null = null;
const TOOLS_CACHE_TTL = 10 * 60 * 1000;

async function fetchToolRegistry(dreamerUrl: string, dreamerKey: string): Promise<ToolSchema[]> {
  if (toolsCache && Date.now() - toolsCache.ts < TOOLS_CACHE_TTL) {
    return toolsCache.tools;
  }
  try {
    const res = await fetch(`${dreamerUrl}/v1/tools`, {
      headers: { 'X-API-Key': dreamerKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return toolsCache?.tools || [];
    const data = await res.json() as { tools: ToolSchema[] };
    toolsCache = { tools: data.tools || [], ts: Date.now() };
    return toolsCache.tools;
  } catch {
    return toolsCache?.tools || [];
  }
}

const TOOL_CATEGORIES: Record<string, { name: string; icon: string; description: string }> = {
  archive_data: { name: 'Web Archive', icon: '📦', description: 'Wayback Machine snapshots and archiving' },
  arxiv_data: { name: 'arXiv', icon: '📄', description: 'Academic paper search and retrieval' },
  census_data: { name: 'Census', icon: '📊', description: 'US Census population and ACS data' },
  finance_data: { name: 'Finance', icon: '💰', description: 'Stock prices, forex, and crypto quotes' },
  github_data: { name: 'GitHub', icon: '🐙', description: 'Repository, code, and issue search' },
  nasa_data: { name: 'NASA', icon: '🚀', description: 'APOD, Mars photos, Earth imagery, NEOs' },
  news_data: { name: 'News', icon: '📰', description: 'Headlines, search, and news sources' },
  openlibrary_data: { name: 'Open Library', icon: '📚', description: 'Book and author search' },
  semantic_scholar_data: { name: 'Semantic Scholar', icon: '🎓', description: 'Academic paper and author search' },
  weather_data: { name: 'Weather', icon: '🌤️', description: 'Current weather, forecasts, and alerts' },
  wikipedia_data: { name: 'Wikipedia', icon: '🌐', description: 'Article search and content retrieval' },
  youtube_data: { name: 'YouTube', icon: '▶️', description: 'Video search, channel stats, playlists' },
};

// ============================================================
// Direct Provider Streaming with Tool Calling
// ============================================================

interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// Build OpenAI-compatible request body (works for OpenAI, xAI, Mistral)
function buildOpenAIBody(
  model: string,
  messages: Array<{ role: string; content: string; tool_call_id?: string; name?: string }>,
  tools: ToolDef[] | undefined,
  temperature?: number,
  maxTokens?: number,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  if (temperature !== undefined) body.temperature = temperature;
  if (maxTokens) body.max_tokens = maxTokens;
  return body;
}

// Stream an OpenAI-compatible SSE response, emitting our normalized events
async function streamOpenAICompatible(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  res: Response,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    res.status(response.status).json({ error: `Provider error (${response.status})`, details: text });
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

  // Parse SSE and re-emit normalized events
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') {
          res.write('data: {"done":true}\n\n');
          continue;
        }
        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          // Text content
          if (delta.content) {
            res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
          }

          // Tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.function?.name) {
                // Start of a tool call
                res.write(`data: ${JSON.stringify({
                  tool_call: {
                    id: tc.id || `call_${Date.now()}`,
                    index: tc.index ?? 0,
                    name: tc.function.name,
                    arguments: tc.function.arguments || '',
                  },
                })}\n\n`);
              } else if (tc.function?.arguments) {
                // Continuation of arguments
                res.write(`data: ${JSON.stringify({
                  tool_call_delta: {
                    index: tc.index ?? 0,
                    arguments: tc.function.arguments,
                  },
                })}\n\n`);
              }
            }
          }

          // Finish reason
          if (chunk.choices?.[0]?.finish_reason === 'tool_calls') {
            res.write(`data: ${JSON.stringify({ finish_reason: 'tool_calls' })}\n\n`);
          }
        } catch { /* skip unparseable lines */ }
      }
    }
  } catch { /* client disconnected */ }
  finally {
    reader.releaseLock();
    res.end();
  }
}

// Stream Anthropic response (different format)
async function streamAnthropic(
  key: string,
  model: string,
  messages: Array<{ role: string; content: string; tool_call_id?: string; tool_use_id?: string }>,
  tools: ToolDef[] | undefined,
  systemPrompt: string | undefined,
  temperature?: number,
  maxTokens?: number,
  res?: Response,
): Promise<void> {
  if (!res) return;

  // Convert messages: Anthropic uses a different format for tool results
  const anthropicMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      if (m.role === 'tool') {
        return {
          role: 'user' as const,
          content: [{
            type: 'tool_result' as const,
            tool_use_id: m.tool_use_id || m.tool_call_id || '',
            content: m.content,
          }],
        };
      }
      return { role: m.role as 'user' | 'assistant', content: m.content };
    });

  // Convert tools to Anthropic format
  const anthropicTools = tools?.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));

  const body: Record<string, unknown> = {
    model,
    messages: anthropicMessages,
    max_tokens: maxTokens || 4096,
    stream: true,
  };
  if (systemPrompt) body.system = systemPrompt;
  if (anthropicTools && anthropicTools.length > 0) body.tools = anthropicTools;
  if (temperature !== undefined) body.temperature = temperature;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    res.status(response.status).json({ error: `Provider error (${response.status})`, details: text });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (!response.body) {
    res.status(500).json({ error: 'No response body' });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentToolId = '';
  let currentToolName = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        try {
          const event = JSON.parse(payload);

          switch (event.type) {
            case 'content_block_start':
              if (event.content_block?.type === 'tool_use') {
                currentToolId = event.content_block.id || `call_${Date.now()}`;
                currentToolName = event.content_block.name || '';
                res.write(`data: ${JSON.stringify({
                  tool_call: {
                    id: currentToolId,
                    index: event.index ?? 0,
                    name: currentToolName,
                    arguments: '',
                  },
                })}\n\n`);
              }
              break;

            case 'content_block_delta':
              if (event.delta?.type === 'text_delta') {
                res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
              } else if (event.delta?.type === 'input_json_delta') {
                res.write(`data: ${JSON.stringify({
                  tool_call_delta: {
                    index: event.index ?? 0,
                    arguments: event.delta.partial_json || '',
                  },
                })}\n\n`);
              }
              break;

            case 'message_delta':
              if (event.delta?.stop_reason === 'tool_use') {
                res.write(`data: ${JSON.stringify({ finish_reason: 'tool_calls' })}\n\n`);
              }
              break;

            case 'message_stop':
              res.write('data: {"done":true}\n\n');
              break;
          }
        } catch { /* skip */ }
      }
    }
  } catch { /* client disconnected */ }
  finally {
    reader.releaseLock();
    res.end();
  }
}

// ============================================================
// Register all routes
// ============================================================

export function registerDreamerProxy(app: Express) {
  const dreamerUrl = (process.env.DREAMER_API_URL || 'http://localhost:5200').replace(/\/$/, '');
  const dreamerKey = process.env.DREAMER_API_KEY || '';

  // List available providers
  app.get('/api/providers', async (_req: Request, res: Response) => {
    const providers: Array<{
      id: string;
      name: string;
      models: string[];
      defaultModel: string;
      available: boolean;
      supportsTools: boolean;
      taskBased?: boolean;
    }> = [
      { id: 'ollama', name: 'Ollama', models: [], defaultModel: 'glm-5', available: true, supportsTools: true },
    ];

    const keys = getProviderKeys();
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
        const supportsTools = ['anthropic', 'openai', 'xai', 'mistral', 'gemini', 'huggingface'].includes(id);
        const taskBased = id === 'manus';
        providers.push({
          id,
          name: DISPLAY_NAMES[id] || id,
          models,
          defaultModel: DEFAULT_MODELS[id] || models[0] || '',
          available: true,
          supportsTools,
          taskBased: taskBased || undefined,
        });
      }
    }

    res.json({ providers });
  });

  // ---- Tool Registry Endpoints ----

  app.get('/api/tools', async (_req: Request, res: Response) => {
    try {
      const tools = await fetchToolRegistry(dreamerUrl, dreamerKey);
      const categories: Record<string, {
        name: string; icon: string; description: string;
        tools: Array<{ name: string; description: string; parameters: unknown }>;
      }> = {};

      for (const tool of tools) {
        const mod = tool.module || 'other';
        if (!categories[mod]) {
          const meta = TOOL_CATEGORIES[mod] || { name: mod, icon: '🔧', description: '' };
          categories[mod] = { ...meta, tools: [] };
        }
        categories[mod].tools.push({
          name: tool.name,
          description: tool.schema?.function?.description || '',
          parameters: tool.schema?.function?.parameters || {},
        });
      }

      res.json({
        categories,
        tools: tools.map(t => ({
          name: t.name,
          module: t.module,
          description: t.schema?.function?.description || '',
          parameters: t.schema?.function?.parameters || {},
        })),
        count: tools.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch tools';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/tools/execute', async (req: Request, res: Response) => {
    const { name, arguments: args } = req.body;
    if (!name) { res.status(400).json({ error: 'Tool name is required' }); return; }
    if (!dreamerKey) { res.status(503).json({ error: 'API gateway not configured' }); return; }
    try {
      const response = await fetch(`${dreamerUrl}/v1/tools/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'X-API-Key': dreamerKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(args || {}),
      });
      const data = await response.json();
      if (!response.ok) {
        res.status(response.status).json({ error: data.error || `Tool execution failed (${response.status})`, result: data });
        return;
      }
      res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Tool execution error';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/tools/schemas', async (_req: Request, res: Response) => {
    try {
      const tools = await fetchToolRegistry(dreamerUrl, dreamerKey);
      const schemas = tools.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.schema?.function?.description || t.name,
          parameters: t.schema?.function?.parameters || { type: 'object', properties: {} },
        },
      }));
      res.json({ tools: schemas });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch tool schemas';
      res.status(500).json({ error: msg });
    }
  });

  // ---- Streaming Chat ----

  app.post('/api/dreamer/chat/stream', async (req: Request, res: Response) => {
    const { provider, model, messages, temperature, maxTokens, systemPrompt, tools } = req.body;

    if (!provider || !messages) {
      res.status(400).json({ error: 'provider and messages are required' });
      return;
    }

    const keys = getProviderKeys();
    const providerKey = keys[provider];

    // If tools are present and provider supports direct API, use direct streaming
    const directProviders = ['anthropic', 'openai', 'xai', 'mistral', 'huggingface'];
    const hasTools = tools && tools.length > 0;
    const useDirectAPI = hasTools && directProviders.includes(provider) && providerKey;

    try {
      if (useDirectAPI) {
        // --- Direct provider API with tool calling ---
        const allMessages = systemPrompt && provider !== 'anthropic'
          ? [{ role: 'system', content: systemPrompt }, ...messages]
          : messages;

        const selectedModel = model || DEFAULT_MODELS[provider] || '';

        if (provider === 'anthropic') {
          await streamAnthropic(
            providerKey, selectedModel, allMessages, tools,
            systemPrompt, temperature, maxTokens, res,
          );
        } else {
          // OpenAI-compatible (openai, xai, mistral)
          const endpoint = PROVIDER_ENDPOINTS[provider];
          const body = buildOpenAIBody(selectedModel, allMessages, tools, temperature, maxTokens);
          const headers: Record<string, string> = { Authorization: `Bearer ${providerKey}` };
          await streamOpenAICompatible(endpoint, headers, body, res);
        }
      } else {
        // --- Fallback: use dreamer gateway (no tool calling) ---
        if (!dreamerKey) {
          res.status(503).json({ error: 'No API key configured for this provider' });
          return;
        }

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
          headers: { 'X-API-Key': dreamerKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          res.status(response.status).json({ error: `Provider error (${response.status})`, details: text });
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
      }
    } catch (err) {
      if (!res.headersSent) {
        const msg = err instanceof Error ? err.message : 'Unknown proxy error';
        res.status(500).json({ error: msg });
      }
    }
  });
}

// ============================================================
// Ollama API Client — Uses Backend Proxy to bypass CORS
// All requests go through /api/ollama/* on our server
// The server relays to the actual Ollama endpoint
// ============================================================

import type {
  OllamaChatRequest,
  OllamaChatChunk,
  OllamaModel,
  ToolCall,
  AppSettings,
  ConnectionMode,
} from './types';
import { OLLAMA_CLOUD_URL } from './types';
import { apiUrl } from './api-base';

export class OllamaClient {
  private baseUrl: string;
  private apiKey: string;
  private connectionMode: ConnectionMode;

  constructor() {
    this.baseUrl = OLLAMA_CLOUD_URL;
    this.apiKey = '';
    this.connectionMode = 'cloud';
  }

  configure(settings: { baseUrl: string; apiKey?: string; connectionMode: ConnectionMode }) {
    this.baseUrl = settings.baseUrl.replace(/\/$/, '');
    if (settings.apiKey !== undefined) this.apiKey = settings.apiKey;
    this.connectionMode = settings.connectionMode;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  setConnectionMode(mode: ConnectionMode) {
    this.connectionMode = mode;
  }

  /** Build proxy headers — tells the backend where to relay */
  private getProxyHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Tell the proxy which Ollama server to target
    if (this.connectionMode === 'cloud') {
      headers['x-ollama-url'] = 'cloud';
    } else {
      headers['x-ollama-url'] = this.baseUrl;
    }

    // Pass the API key to the proxy
    if (this.apiKey) {
      headers['x-ollama-key'] = this.apiKey;
    }

    return headers;
  }

  async listModels(): Promise<OllamaModel[]> {
    const res = await fetch(apiUrl('/api/ollama/tags'), {
      headers: this.getProxyHeaders(),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(data.error || data.details || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.models || [];
  }

  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/ollama/health'), {
        headers: this.getProxyHeaders(),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.connected === true;
    } catch {
      return false;
    }
  }

  async *streamChat(
    request: OllamaChatRequest,
    signal?: AbortSignal
  ): AsyncGenerator<OllamaChatChunk> {
    const res = await fetch(apiUrl('/api/ollama/chat/stream'), {
      method: 'POST',
      headers: this.getProxyHeaders(),
      body: JSON.stringify(request),
      signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(data.error || data.details || `Ollama error (${res.status})`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

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
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk: OllamaChatChunk = JSON.parse(trimmed);
            yield chunk;
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          yield JSON.parse(buffer.trim());
        } catch {
          // Skip
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async chat(
    request: OllamaChatRequest,
    signal?: AbortSignal
  ): Promise<OllamaChatChunk> {
    const res = await fetch(apiUrl('/api/ollama/chat'), {
      method: 'POST',
      headers: this.getProxyHeaders(),
      body: JSON.stringify(request),
      signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(data.error || data.details || `Ollama error (${res.status})`);
    }

    return res.json();
  }

  buildRequest(
    messages: Array<{ role: string; content: string; images?: string[]; tool_calls?: ToolCall[]; tool_name?: string }>,
    settings: AppSettings,
    model?: string
  ): OllamaChatRequest {
    const req: OllamaChatRequest = {
      model: model || settings.defaultModel,
      messages: messages.map(m => {
        const msg: Record<string, unknown> = { role: m.role, content: m.content };
        if (m.images?.length) msg.images = m.images;
        if (m.tool_calls?.length) msg.tool_calls = m.tool_calls;
        if (m.tool_name) msg.tool_name = m.tool_name;
        return msg as OllamaChatRequest['messages'][0];
      }),
      options: {
        temperature: settings.temperature,
        top_p: settings.topP,
        num_predict: settings.maxTokens,
      },
    };

    if (settings.enableThinking) {
      req.think = true;
    }

    return req;
  }
}

// Tool execution is now handled by tool-service.ts
// import { executeTool } from './tool-service' for builtin + remote tool execution

// Singleton client
export const ollamaClient = new OllamaClient();

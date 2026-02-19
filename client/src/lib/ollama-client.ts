// ============================================================
// Ollama API Client — Streaming + Tool Use Support
// Design: Warm Companion — handles all Ollama communication
// ============================================================

import type {
  OllamaChatRequest,
  OllamaChatChunk,
  OllamaModel,
  ToolCall,
  AppSettings,
} from './types';

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  async listModels(): Promise<OllamaModel[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.models || [];
    } catch (err) {
      console.error('Failed to list models:', err);
      throw err;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async *streamChat(
    request: OllamaChatRequest,
    signal?: AbortSignal
  ): AsyncGenerator<OllamaChatChunk> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, stream: true }),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Ollama error (${res.status}): ${errText}`);
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
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, stream: false }),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Ollama error (${res.status}): ${errText}`);
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

// Execute built-in tools locally
export function executeBuiltInTool(
  toolName: string,
  args: Record<string, unknown>
): string {
  switch (toolName) {
    case 'get_current_time': {
      const tz = (args.timezone as string) || Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        return new Date().toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' });
      } catch {
        return new Date().toLocaleString();
      }
    }
    case 'calculate': {
      const expr = args.expression as string;
      try {
        // Safe math evaluation using Function constructor
        const result = new Function(`"use strict"; return (${expr})`)();
        return String(result);
      } catch (e) {
        return `Error: Could not evaluate "${expr}" — ${e instanceof Error ? e.message : 'unknown error'}`;
      }
    }
    case 'web_search': {
      const query = args.query as string;
      return `[Web search results for "${query}" would appear here. Connect to a search API for real results.]`;
    }
    case 'generate_image': {
      const prompt = args.prompt as string;
      return `[Image generation for "${prompt}" would appear here. Connect to an image generation API for real results.]`;
    }
    default:
      return `Unknown tool: ${toolName}`;
  }
}

// Singleton client
export const ollamaClient = new OllamaClient();

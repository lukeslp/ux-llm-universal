// ============================================================
// Dreamer API Client — Multi-provider LLM via server proxy
// All requests go through /api/dreamer/* — no keys in browser
// Supports tool calling for providers that support it
// ============================================================

import { apiUrl } from './api-base';

export interface Provider {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  available: boolean;
  supportsTools: boolean;
}

export interface DreamerMessage {
  role: string;
  content: string;
  tool_call_id?: string;
  tool_use_id?: string;
  name?: string;
}

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface DreamerToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface DreamerStreamEvent {
  content?: string;
  done?: boolean;
  error?: string;
  tool_call?: {
    id: string;
    index: number;
    name: string;
    arguments: string;
  };
  tool_call_delta?: {
    index: number;
    arguments: string;
  };
  finish_reason?: string;
}

export async function fetchProviders(): Promise<Provider[]> {
  try {
    const res = await fetch(apiUrl('/api/providers'), {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.providers || [];
  } catch {
    return [];
  }
}

export async function* streamDreamerChat(
  provider: string,
  model: string | undefined,
  messages: DreamerMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    tools?: ToolDef[];
  },
  signal?: AbortSignal
): AsyncGenerator<DreamerStreamEvent> {
  const res = await fetch(apiUrl('/api/dreamer/chat/stream'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      model: model || undefined,
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      systemPrompt: options.systemPrompt,
      tools: options.tools,
    }),
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(data.error || data.details || `Provider error (${res.status})`);
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
        if (!trimmed.startsWith('data: ')) continue;
        const json = trimmed.slice(6);
        if (!json) continue;
        try {
          yield JSON.parse(json);
        } catch {
          // Skip malformed
        }
      }
    }

    if (buffer.trim().startsWith('data: ')) {
      try {
        yield JSON.parse(buffer.trim().slice(6));
      } catch {
        // Skip
      }
    }
  } finally {
    reader.releaseLock();
  }
}

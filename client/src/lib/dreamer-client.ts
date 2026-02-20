// ============================================================
// Dreamer API Client — Multi-provider LLM via server proxy
// All requests go through /api/dreamer/* — no keys in browser
// ============================================================

export interface Provider {
  id: string;
  name: string;
  models: string[];
  available: boolean;
}

export interface DreamerMessage {
  role: string;
  content: string;
}

export async function fetchProviders(): Promise<Provider[]> {
  try {
    const res = await fetch('/api/providers', {
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
  options: { temperature?: number; maxTokens?: number; systemPrompt?: string },
  signal?: AbortSignal
): AsyncGenerator<{ content?: string; done?: boolean; error?: string }> {
  const res = await fetch('/api/dreamer/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      model: model || undefined,
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      systemPrompt: options.systemPrompt,
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

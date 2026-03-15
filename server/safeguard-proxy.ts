// ============================================================
// Safeguard Proxy — Content safety evaluation via HuggingFace API
// Uses gpt-oss-safeguard-20b for streaming reasoning + verdict
// ============================================================

import type { Express, Request, Response } from 'express';

const HF_API_KEY = process.env.HF_API_KEY;
const SAFEGUARD_MODEL = 'openai/gpt-oss-safeguard-20b';
const HF_INFERENCE_URL = 'https://router.huggingface.co/hf-inference/models';

// Default safety policy
const DEFAULT_POLICY = `Evaluate the following content for safety concerns across these categories:
- Violence and gore
- Sexual content
- Hate speech and discrimination
- Self-harm and suicide
- Illegal activities
- Personal information exposure
- Misinformation

For each category, assess severity as: safe, low, medium, high, critical.
Provide an overall verdict: SAFE, CAUTION, or UNSAFE.
Explain your reasoning step by step.`;

export function registerSafeguardProxy(app: Express) {
  // Evaluate content safety
  app.post('/api/safeguard/evaluate', async (req: Request, res: Response) => {
    const { content, policy } = req.body;

    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    if (!HF_API_KEY) {
      res.status(503).json({ error: 'HuggingFace API key not configured (HF_API_KEY)' });
      return;
    }

    const systemPrompt = policy || DEFAULT_POLICY;

    // Stream NDJSON: reasoning chunks + final verdict
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    try {
      const response = await fetch(`${HF_INFERENCE_URL}/${SAFEGUARD_MODEL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: SAFEGUARD_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content },
          ],
          stream: true,
          max_tokens: 2048,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        res.write(JSON.stringify({ type: 'error', error: `API error: ${response.status} ${errText}` }) + '\n');
        res.end();
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        res.write(JSON.stringify({ type: 'error', error: 'No response body' }) + '\n');
        res.end();
        return;
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              res.write(JSON.stringify({ type: 'reasoning', content }) + '\n');
            }
          } catch {
            // Skip unparseable chunks
          }
        }
      }

      // Parse verdict from full content
      const verdict = parseVerdict(fullContent);
      res.write(JSON.stringify({ type: 'verdict', ...verdict, fullReasoning: fullContent }) + '\n');
      res.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Evaluation failed';
      res.write(JSON.stringify({ type: 'error', error: msg }) + '\n');
      res.end();
    }
  });

  // Policy templates
  app.get('/api/safeguard/policies', (_req: Request, res: Response) => {
    res.json({
      policies: [
        { id: 'default', name: 'General Safety', description: 'Standard content safety evaluation', policy: DEFAULT_POLICY },
        { id: 'child-safety', name: 'Child Safety', description: 'Content appropriate for minors', policy: 'Evaluate content for appropriateness for audiences under 18...' },
        { id: 'workplace', name: 'Workplace', description: 'Professional/workplace appropriate', policy: 'Evaluate content for professional workplace appropriateness...' },
      ],
    });
  });
}

function parseVerdict(content: string): { verdict: string; severity: string; categories: Record<string, string> } {
  const upper = content.toUpperCase();
  let verdict = 'UNKNOWN';
  if (upper.includes('UNSAFE') || upper.includes('VERDICT: UNSAFE')) verdict = 'UNSAFE';
  else if (upper.includes('CAUTION') || upper.includes('VERDICT: CAUTION')) verdict = 'CAUTION';
  else if (upper.includes('SAFE') || upper.includes('VERDICT: SAFE')) verdict = 'SAFE';

  const severityMap: Record<string, string> = { SAFE: 'safe', CAUTION: 'medium', UNSAFE: 'critical' };
  const severity = severityMap[verdict] || 'unknown';

  return { verdict, severity, categories: {} };
}

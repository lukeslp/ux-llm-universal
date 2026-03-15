// ============================================================
// Evaluate Page — Content safety classification (safeguard)
// Route: /evaluate
// Dual-panel: streaming reasoning + verdict
// ============================================================

import { useState, useRef, useCallback } from 'react';
import {
  Shield, Send, Loader2, AlertTriangle,
  CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { apiUrl } from '@/lib/api-base';

interface Verdict {
  verdict: string;
  severity: string;
  fullReasoning: string;
  categories: Record<string, string>;
}

export default function EvaluatePage() {
  const [content, setContent] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [reasoning, setReasoning] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reasoningRef = useRef<HTMLDivElement>(null);

  const evaluate = useCallback(async () => {
    if (!content.trim()) return;
    setIsEvaluating(true);
    setReasoning('');
    setVerdict(null);
    setError(null);

    try {
      const res = await fetch(apiUrl('/api/safeguard/evaluate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error || `Evaluation failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumReasoning = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'reasoning') {
              accumReasoning += parsed.content;
              setReasoning(accumReasoning);
              // Auto-scroll
              if (reasoningRef.current) {
                reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
              }
            } else if (parsed.type === 'verdict') {
              setVerdict(parsed);
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setIsEvaluating(false);
    }
  }, [content]);

  const verdictIcon = {
    SAFE: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
    CAUTION: <AlertCircle className="w-6 h-6 text-amber-500" />,
    UNSAFE: <XCircle className="w-6 h-6 text-destructive" />,
  };

  const verdictColor = {
    SAFE: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    CAUTION: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
    UNSAFE: 'bg-destructive/10 border-destructive/20 text-destructive',
  };

  const hasResults = reasoning || verdict;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Dual panel layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Input panel */}
        <div className="flex-1 flex flex-col p-6 border-r border-border/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-500/70" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Content Evaluation</h2>
              <p className="text-xs text-muted-foreground/60">Analyze content for safety concerns</p>
            </div>
          </div>

          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Paste or type content to evaluate for safety..."
            className="flex-1 resize-none text-sm min-h-[200px]"
            disabled={isEvaluating}
          />

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground/50">
              {content.length} characters
            </span>
            <Button
              onClick={evaluate}
              disabled={!content.trim() || isEvaluating}
              className="gap-2"
            >
              {isEvaluating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Evaluate
            </Button>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Right: Results panel */}
        <div className="flex-1 flex flex-col p-6">
          {!hasResults ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground/60">
                  Submit content to see the safety evaluation
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Verdict badge */}
              <AnimatePresence>
                {verdict && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl border mb-4 flex items-center gap-3 ${
                      verdictColor[verdict.verdict as keyof typeof verdictColor] || 'bg-muted/50 border-border'
                    }`}
                  >
                    {verdictIcon[verdict.verdict as keyof typeof verdictIcon] || <AlertCircle className="w-6 h-6" />}
                    <div>
                      <p className="font-semibold text-sm">
                        Verdict: {verdict.verdict}
                      </p>
                      <p className="text-xs opacity-70">
                        Severity: {verdict.severity}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-auto">
                      {verdict.verdict}
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Streaming reasoning */}
              <div className="flex-1 min-h-0">
                <p className="eyebrow mb-2">Reasoning</p>
                <div
                  ref={reasoningRef}
                  className="h-full overflow-y-auto rounded-xl bg-muted/30 border border-border/30 p-4"
                >
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                    {reasoning}
                    {isEvaluating && (
                      <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5 -mb-0.5" />
                    )}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

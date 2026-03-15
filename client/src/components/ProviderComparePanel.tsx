// ============================================================
// ProviderComparePanel — Compare image generation across providers
// Generate the same prompt on multiple providers simultaneously
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { Columns2, Loader2, Sparkles, AlertTriangle, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProviders } from '@/contexts/ProviderContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiUrl } from '@/lib/api-base';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ProviderResult {
  providerId: string;
  providerName: string;
  status: 'idle' | 'loading' | 'done' | 'error';
  imageUrl?: string;
  revisedPrompt?: string;
  error?: string;
  durationMs?: number;
}

interface ComparisonRun {
  id: string;
  prompt: string;
  results: ProviderResult[];
  timestamp: number;
}

// Provider color coding
const PROVIDER_COLORS: Record<string, string> = {
  openai: 'border-green-500/30 bg-green-500/5',
  xai: 'border-blue-500/30 bg-blue-500/5',
  huggingface: 'border-yellow-500/30 bg-yellow-500/5',
};

const PROVIDER_BADGES: Record<string, string> = {
  openai: 'bg-green-500/20 text-green-600',
  xai: 'bg-blue-500/20 text-blue-600',
  huggingface: 'bg-yellow-500/20 text-yellow-600',
};

export default function ProviderComparePanel() {
  const { themeName } = useTheme();
  const { providers } = useProviders();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [runs, setRuns] = useState<ComparisonRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filter to providers that support image generation
  const imageProviders = useMemo(
    () => providers.filter((p: any) => p.capabilities?.includes('image_generation') && p.imageGenModels?.length),
    [providers],
  );

  // Track which providers are selected for comparison
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(new Set());

  // Sync initial selection when providers load async
  useEffect(() => {
    if (imageProviders.length > 0 && selectedProviderIds.size === 0) {
      setSelectedProviderIds(new Set(imageProviders.slice(0, 3).map((p: any) => p.id)));
    }
  }, [imageProviders]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleProvider = (id: string) => {
    setSelectedProviderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // Keep at least 1
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || selectedProviderIds.size === 0) return;
    setIsGenerating(true);
    setError(null);

    const runId = `cmp_${Date.now()}`;
    const selectedProviders = imageProviders.filter((p: any) => selectedProviderIds.has(p.id));

    // Initialize results
    const initialResults: ProviderResult[] = selectedProviders.map((p: any) => ({
      providerId: p.id,
      providerName: p.name,
      status: 'loading' as const,
    }));

    const newRun: ComparisonRun = {
      id: runId,
      prompt: prompt.trim(),
      results: initialResults,
      timestamp: Date.now(),
    };

    setRuns(prev => [newRun, ...prev]);

    // Fire all requests in parallel
    const promises = selectedProviders.map(async (p: any) => {
      const start = Date.now();
      try {
        const res = await fetch(apiUrl('/api/image/generate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            provider: p.id,
            model: p.imageGenDefault || p.imageGenModels?.[0],
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(data.error || `Failed (${res.status})`);
        }

        const data = await res.json();
        const urls: string[] = data.images || (data.url ? [data.url] : []);

        return {
          providerId: p.id,
          status: 'done' as const,
          imageUrl: urls[0],
          revisedPrompt: data.revised_prompt,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return {
          providerId: p.id,
          status: 'error' as const,
          error: err instanceof Error ? err.message : 'Failed',
          durationMs: Date.now() - start,
        };
      }
    });

    // Update results as they come in
    for (const promise of promises) {
      promise.then(result => {
        setRuns(prev => prev.map(r =>
          r.id === runId
            ? {
                ...r,
                results: r.results.map(pr =>
                  pr.providerId === result.providerId
                    ? { ...pr, ...result }
                    : pr,
                ),
              }
            : r,
        ));
      });
    }

    // Wait for all to complete
    await Promise.allSettled(promises);
    setIsGenerating(false);
    setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const noProviders = imageProviders.length === 0;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Results area */}
      <div className="flex-1 overflow-y-auto chat-scroll p-4">
        {noProviders ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center',
              themeName === 'nebula' ? 'bg-indigo-900/20' : themeName === 'slate' ? 'bg-teal-900/20' : 'bg-amber-900/20',
            )}>
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="eyebrow mb-2">NO IMAGE PROVIDERS</p>
              <p className="text-sm">Need at least 2 providers with image generation</p>
            </div>
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center',
              themeName === 'nebula' ? 'bg-indigo-900/20' : themeName === 'slate' ? 'bg-teal-900/20' : 'bg-amber-900/20',
            )}>
              <Columns2 className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="eyebrow mb-2">PROVIDER COMPARISON</p>
              <p className="text-sm">Compare the same prompt across multiple providers</p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                {imageProviders.length} provider{imageProviders.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-5xl mx-auto">
            <AnimatePresence>
              {runs.map(run => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <p className="text-sm font-medium text-foreground/80 px-1">{run.prompt}</p>
                  <div className={cn(
                    'grid gap-3',
                    run.results.length === 2 ? 'grid-cols-2' :
                    run.results.length === 3 ? 'grid-cols-3' :
                    'grid-cols-2 md:grid-cols-4',
                  )}>
                    {run.results.map(result => (
                      <div
                        key={result.providerId}
                        className={cn(
                          'rounded-xl border overflow-hidden',
                          PROVIDER_COLORS[result.providerId] || 'border-border bg-card',
                        )}
                      >
                        {/* Provider header */}
                        <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-border/30">
                          <span className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded',
                            PROVIDER_BADGES[result.providerId] || 'bg-muted text-muted-foreground',
                          )}>
                            {result.providerName}
                          </span>
                          {result.durationMs && (
                            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                              {(result.durationMs / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        {result.status === 'loading' ? (
                          <div className="aspect-square flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
                          </div>
                        ) : result.status === 'done' && result.imageUrl ? (
                          <div className="relative group">
                            <img
                              src={result.imageUrl}
                              alt={run.prompt}
                              className="w-full aspect-square object-cover"
                            />
                            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a
                                href={result.imageUrl}
                                download
                                className="h-7 w-7 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            {result.revisedPrompt && (
                              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-[10px] text-white/80 line-clamp-2">{result.revisedPrompt}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="aspect-square flex flex-col items-center justify-center gap-2 px-3">
                            <AlertTriangle className="w-5 h-5 text-destructive/60" />
                            <p className="text-[10px] text-destructive/70 text-center line-clamp-3">{result.error}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-destructive/10 border-t border-destructive/20"
          >
            <p className="text-sm text-destructive text-center max-w-3xl mx-auto">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      {!noProviders && (
        <div className="border-t border-border bg-background/80 backdrop-blur-sm px-4 py-3">
          <div className="max-w-3xl mx-auto space-y-2">
            {/* Provider checkboxes */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground/60 mr-1">Compare:</span>
              {imageProviders.map((p: any) => {
                const selected = selectedProviderIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleProvider(p.id)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md transition-colors',
                      selected
                        ? cn('font-medium', PROVIDER_BADGES[p.id] || 'bg-primary/20 text-primary')
                        : 'text-muted-foreground/60 hover:text-foreground bg-muted/30 hover:bg-muted/50',
                    )}
                  >
                    {selected && <Check className="w-2.5 h-2.5" />}
                    {p.name}
                  </button>
                );
              })}
            </div>

            {/* Prompt input */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter a prompt to compare across providers..."
                  rows={1}
                  disabled={isGenerating}
                  className="w-full resize-none border border-border bg-card px-4 py-3 text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50 rounded-xl"
                />
              </div>
              <Button
                size="sm"
                disabled={!prompt.trim() || isGenerating || selectedProviderIds.size === 0}
                onClick={handleGenerate}
                className="h-10 w-10 shrink-0 p-0 rounded-full"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

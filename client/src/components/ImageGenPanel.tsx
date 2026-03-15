// ============================================================
// ImageGenPanel — Image generation with provider/model filtering
// Uses JobContext for tracking, MediaViewer for gallery viewing
// ============================================================

import { useState, useMemo } from 'react';
import { Image as ImageIcon, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useProviders } from '@/contexts/ProviderContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useJobs, type ImageJob } from '@/contexts/JobContext';
import { apiUrl } from '@/lib/api-base';
import { MediaViewer, type MediaItem } from '@/components/MediaViewer';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';

interface GeneratedImage {
  url: string;
  prompt: string;
  provider: string;
  model: string;
  timestamp: number;
}

export default function ImageGenPanel() {
  const { themeName } = useTheme();
  const { providers } = useProviders();
  const { addJob, updateJob } = useJobs();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Filter to providers that have image_generation capability
  const imageProviders = useMemo(
    () => providers.filter((p: any) => p.capabilities?.includes('image_generation') && p.imageGenModels?.length),
    [providers],
  );

  const [selectedProvider, setSelectedProvider] = useState<string>(() =>
    imageProviders[0]?.id || '',
  );
  const currentProvider = imageProviders.find((p: any) => p.id === selectedProvider) || imageProviders[0];

  const [selectedModel, setSelectedModel] = useState<string>(() =>
    (currentProvider as any)?.imageGenDefault || (currentProvider as any)?.imageGenModels?.[0] || '',
  );

  const handleProviderChange = (id: string) => {
    setSelectedProvider(id);
    const p = imageProviders.find((pr: any) => pr.id === id);
    setSelectedModel((p as any)?.imageGenDefault || (p as any)?.imageGenModels?.[0] || '');
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !selectedProvider || !selectedModel) return;
    setIsGenerating(true);
    setError(null);

    // Track in JobContext
    const jobId = uuidv4();
    const job: ImageJob = {
      id: jobId,
      type: 'image',
      status: 'processing',
      prompt: prompt.trim(),
      provider: selectedProvider,
      model: selectedModel,
      startedAt: Date.now(),
    };
    addJob(job);

    try {
      const res = await fetch(apiUrl('/api/image/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          provider: selectedProvider,
          model: selectedModel,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error || `Generation failed (${res.status})`);
      }

      const data = await res.json();
      const urls: string[] = data.images || (data.url ? [data.url] : []);
      const newImages: GeneratedImage[] = urls.map(url => ({
        url,
        prompt: prompt.trim(),
        provider: selectedProvider,
        model: selectedModel,
        timestamp: Date.now(),
      }));
      setGeneratedImages(prev => [...newImages, ...prev]);

      // Update job
      updateJob(jobId, {
        status: 'done',
        url: urls[0],
        completedAt: Date.now(),
      });
      setPrompt('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setError(msg);
      updateJob(jobId, { status: 'error', error: msg, completedAt: Date.now() });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  // Convert to MediaViewer format
  const mediaItems: MediaItem[] = generatedImages.map(img => ({
    type: 'image' as const,
    url: img.url,
    prompt: img.prompt,
    metadata: { provider: img.provider, model: img.model },
  }));

  const noProviders = imageProviders.length === 0;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Gallery area */}
      <div className="flex-1 overflow-y-auto chat-scroll p-4">
        {noProviders ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              themeName === 'nebula' ? 'bg-indigo-900/20' :
              themeName === 'slate' ? 'bg-teal-900/20' :
              'bg-amber-900/20'
            }`}>
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="eyebrow mb-2">NO IMAGE PROVIDERS</p>
              <p className="text-sm">No providers with image generation are configured.</p>
              <p className="text-xs text-muted-foreground/50 mt-2">
                Add an API key for OpenAI (DALL-E), xAI (Grok), or HuggingFace (Flux/SDXL) in your server .env
              </p>
            </div>
          </div>
        ) : generatedImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              themeName === 'nebula' ? 'bg-indigo-900/20' :
              themeName === 'slate' ? 'bg-teal-900/20' :
              'bg-amber-900/20'
            }`}>
              <ImageIcon className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="eyebrow mb-2">IMAGE GENERATION</p>
              <p className="text-sm">Describe an image to generate it</p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                Using {(currentProvider as any)?.name || 'provider'}, {selectedModel}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {generatedImages.map((img, i) => (
              <motion.div
                key={img.timestamp + i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`aspect-square rounded-xl overflow-hidden cursor-pointer group relative ${
                  themeName === 'nebula' ? 'border border-indigo-500/20' :
                  'border border-border'
                }`}
                onClick={() => openViewer(i)}
              >
                <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                  <p className="text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity line-clamp-2">
                    {img.prompt}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* MediaViewer — replaces simple lightbox */}
      <MediaViewer
        items={mediaItems}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

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
            <div className="flex items-center gap-2">
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger className="h-7 text-xs border-border/60 bg-transparent w-auto min-w-[100px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  {imageProviders.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="h-7 text-xs border-border/60 bg-transparent w-auto min-w-[120px]">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  {((currentProvider as any)?.imageGenModels || []).map((m: string) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the image you want to generate..."
                  rows={1}
                  disabled={isGenerating}
                  className="w-full resize-none border border-border bg-card px-4 py-3 text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50 rounded-xl"
                />
              </div>
              <Button
                size="sm"
                disabled={!prompt.trim() || isGenerating}
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

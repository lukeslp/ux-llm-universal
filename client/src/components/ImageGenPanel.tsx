// ============================================================
// ImageGenPanel — Image generation with provider/model filtering
// Only shows providers that support image_generation capability
// ============================================================

import { useState, useMemo } from 'react';
import { Image as ImageIcon, Loader2, Sparkles, AlertTriangle, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useChat } from '@/contexts/ChatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiUrl } from '@/lib/api-base';
import { motion, AnimatePresence } from 'framer-motion';

interface GeneratedImage {
  url: string;
  prompt: string;
  provider: string;
  model: string;
  timestamp: number;
}

export default function ImageGenPanel() {
  const { themeName } = useTheme();
  const { state } = useChat();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Filter to providers that have image_generation capability
  const imageProviders = useMemo(
    () => state.providers.filter(p => p.capabilities?.includes('image_generation') && p.imageGenModels?.length),
    [state.providers],
  );

  // Default to first available image provider
  const [selectedProvider, setSelectedProvider] = useState<string>(() =>
    imageProviders[0]?.id || '',
  );
  const currentProvider = imageProviders.find(p => p.id === selectedProvider) || imageProviders[0];

  const [selectedModel, setSelectedModel] = useState<string>(() =>
    currentProvider?.imageGenDefault || currentProvider?.imageGenModels?.[0] || '',
  );

  // When provider changes, reset model to that provider's default
  const handleProviderChange = (id: string) => {
    setSelectedProvider(id);
    const p = imageProviders.find(pr => pr.id === id);
    setSelectedModel(p?.imageGenDefault || p?.imageGenModels?.[0] || '');
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !selectedProvider || !selectedModel) return;
    setIsGenerating(true);
    setError(null);

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
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
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

  const noProviders = imageProviders.length === 0;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Gallery area */}
      <div className="flex-1 overflow-y-auto chat-scroll p-4">
        {noProviders ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className={`w-16 h-16 flex items-center justify-center ${
              themeName === 'hearthstone' ? 'rounded-2xl bg-amber-900/20' :
              themeName === 'zurich' ? 'rounded-none border-2 border-border' :
              'rounded-2xl bg-indigo-900/20'
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
            <div className={`w-16 h-16 flex items-center justify-center ${
              themeName === 'hearthstone' ? 'rounded-2xl bg-amber-900/20' :
              themeName === 'zurich' ? 'rounded-none border-2 border-border' :
              'rounded-2xl bg-indigo-900/20'
            }`}>
              <ImageIcon className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="eyebrow mb-2">IMAGE GENERATION</p>
              <p className="text-sm">Describe an image to generate it</p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                Using {currentProvider?.name || 'provider'} — {selectedModel}
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
                className={`aspect-square overflow-hidden cursor-pointer group relative ${
                  themeName === 'zurich' ? 'border-2 border-border' :
                  themeName === 'nebula' ? 'rounded-xl border border-indigo-500/20' :
                  'rounded-xl border border-border'
                }`}
                onClick={() => setLightboxIdx(i)}
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

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIdx !== null && generatedImages[lightboxIdx] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightboxIdx(null)}
          >
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 text-white hover:bg-white/20 h-10 w-10 p-0 rounded-full"
              onClick={() => setLightboxIdx(null)}
            >
              <X className="w-5 h-5" />
            </Button>
            <img
              src={generatedImages[lightboxIdx].url}
              alt={generatedImages[lightboxIdx].prompt}
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Input bar with provider/model selectors */}
      {!noProviders && (
        <div className="border-t border-border bg-background/80 backdrop-blur-sm px-4 py-3">
          <div className="max-w-3xl mx-auto space-y-2">
            {/* Provider + model selectors */}
            <div className="flex items-center gap-2">
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger className="h-7 text-xs border-border/60 bg-transparent w-auto min-w-[100px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  {imageProviders.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="h-7 text-xs border-border/60 bg-transparent w-auto min-w-[120px]">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  {(currentProvider?.imageGenModels || []).map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prompt input + send */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the image you want to generate..."
                  rows={1}
                  disabled={isGenerating}
                  className={`w-full resize-none border border-border bg-card px-4 py-3 text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50 ${
                    themeName === 'zurich' ? 'rounded-none border-2' : 'rounded-xl'
                  }`}
                />
              </div>
              <Button
                size="sm"
                disabled={!prompt.trim() || isGenerating}
                onClick={handleGenerate}
                className={`h-10 w-10 shrink-0 p-0 ${
                  themeName === 'zurich' ? 'rounded-none' : 'rounded-full'
                }`}
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

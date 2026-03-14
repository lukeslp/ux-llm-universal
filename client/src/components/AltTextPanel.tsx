// ============================================================
// VisionPanel — Multi-purpose image analysis via vision providers
// Supports: Alt text, Describe, Analyze, OCR, Q&A about images
// Only shows providers with 'vision' capability
// ============================================================

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Upload, Eye, Loader2, AlertTriangle, Copy, Check, RefreshCw, Send, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useChat } from '@/contexts/ChatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiUrl } from '@/lib/api-base';
import { motion, AnimatePresence } from 'framer-motion';

type VisionTask = 'alt-text' | 'describe' | 'analyze' | 'ocr' | 'ask';

const VISION_TASKS: { id: VisionTask; label: string; prompt: string }[] = [
  {
    id: 'alt-text',
    label: 'Alt Text',
    prompt: 'Write concise, accessible alt text for this image. Focus on what matters for someone who cannot see it. Return only the alt text, no preamble.',
  },
  {
    id: 'describe',
    label: 'Describe',
    prompt: 'Describe this image in rich detail — subject, composition, colors, lighting, mood, and any notable elements. Be thorough but organized.',
  },
  {
    id: 'analyze',
    label: 'Analyze',
    prompt: 'Analyze this image. Identify the type of content (photo, diagram, screenshot, artwork, etc.), key elements, any text visible, data shown, and provide insight into its purpose or context.',
  },
  {
    id: 'ocr',
    label: 'Extract Text',
    prompt: 'Extract all text visible in this image. Preserve formatting, layout, and hierarchy as much as possible. If the image contains a table, format it as a markdown table. Return only the extracted text.',
  },
];

interface VisionResult {
  task: VisionTask;
  text: string;
  provider: string;
  model: string;
  timestamp: number;
}

export default function VisionPanel() {
  const { themeName } = useTheme();
  const { state } = useChat();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [results, setResults] = useState<VisionResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [activeTask, setActiveTask] = useState<VisionTask>('alt-text');
  const [customQuestion, setCustomQuestion] = useState('');

  // Filter to providers with vision capability
  const visionProviders = useMemo(
    () => state.providers.filter(p => p.capabilities?.includes('vision') && p.visionModels?.length),
    [state.providers],
  );

  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Auto-select first provider when available
  useEffect(() => {
    if (!selectedProvider && visionProviders.length > 0) {
      const p = visionProviders[0];
      setSelectedProvider(p.id);
      setSelectedModel(p.visionDefault || p.visionModels?.[0] || '');
    }
  }, [visionProviders, selectedProvider]);

  const currentProvider = visionProviders.find(p => p.id === selectedProvider);

  const handleProviderChange = (id: string) => {
    setSelectedProvider(id);
    const p = visionProviders.find(pr => pr.id === id);
    setSelectedModel(p?.visionDefault || p?.visionModels?.[0] || '');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImage(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
      setResults([]);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImage(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
      setResults([]);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const runVisionTask = useCallback(async (task: VisionTask, question?: string) => {
    if (!imageBase64 || !selectedProvider || !selectedModel) return;
    setIsProcessing(true);
    setError(null);

    const taskDef = VISION_TASKS.find(t => t.id === task);
    const promptText = task === 'ask' && question
      ? question
      : taskDef?.prompt || 'Describe this image.';

    try {
      const res = await fetch(apiUrl('/api/vision/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          image: imageBase64,
          prompt: promptText,
          media_type: 'image/png',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error || `Vision request failed (${res.status})`);
      }

      const data = await res.json() as { text?: string };
      const text = data.text || 'No response generated';

      setResults(prev => [{
        task,
        text,
        provider: selectedProvider,
        model: selectedModel,
        timestamp: Date.now(),
      }, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vision analysis failed');
    } finally {
      setIsProcessing(false);
    }
  }, [imageBase64, selectedProvider, selectedModel]);

  const handleCopy = async (idx: number) => {
    await navigator.clipboard.writeText(results[idx].text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAsk = () => {
    if (!customQuestion.trim()) return;
    runVisionTask('ask', customQuestion.trim());
    setCustomQuestion('');
  };

  const noProviders = visionProviders.length === 0;

  return (
    <div
      className="flex-1 flex flex-col min-w-0"
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
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
              <p className="eyebrow mb-2">NO VISION PROVIDERS</p>
              <p className="text-sm">No providers with vision capability are configured.</p>
              <p className="text-xs text-muted-foreground/50 mt-2">
                Add an API key for Anthropic, OpenAI, xAI, Gemini, or Mistral in your server .env
              </p>
            </div>
          </div>
        ) : !image ? (
          /* Upload state */
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              themeName === 'nebula' ? 'bg-indigo-900/20' :
              themeName === 'slate' ? 'bg-teal-900/20' :
              'bg-amber-900/20'
            }`}>
              <Eye className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="eyebrow mb-2">VISION</p>
              <p className="text-sm">Upload or drop an image to analyze it</p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                Alt text, descriptions, analysis, text extraction, and Q&A
              </p>
            </div>

            <label className="cursor-pointer">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <Button variant="outline" asChild>
                <span className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Image
                </span>
              </Button>
            </label>
          </div>
        ) : (
          /* Image loaded — show analysis UI */
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Image preview + provider bar */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Image */}
              <div className={`md:w-1/3 shrink-0 relative group overflow-hidden rounded-xl ${
                themeName === 'nebula' ? 'border border-indigo-500/20' :
                'border border-border'
              }`}>
                <img src={image} alt="Uploaded for analysis" className="w-full h-auto" />
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => { setImage(null); setImageBase64(null); setResults([]); }}
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <Button variant="secondary" size="sm" className="h-7 w-7 p-0" asChild title="Replace">
                      <span><Upload className="w-3.5 h-3.5" /></span>
                    </Button>
                  </label>
                </div>
              </div>

              {/* Controls */}
              <div className="flex-1 space-y-3">
                {/* Provider + model */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={selectedProvider} onValueChange={handleProviderChange}>
                    <SelectTrigger className="h-7 text-xs border-border/60 bg-transparent w-auto min-w-[100px]">
                      <SelectValue placeholder="Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {visionProviders.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="h-7 text-xs border-border/60 bg-transparent w-auto min-w-[120px]">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {(currentProvider?.visionModels || []).map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Task buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {VISION_TASKS.map(t => (
                    <Button
                      key={t.id}
                      variant={activeTask === t.id ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      disabled={isProcessing}
                      onClick={() => {
                        setActiveTask(t.id);
                        runVisionTask(t.id);
                      }}
                    >
                      {isProcessing && activeTask === t.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : null}
                      {t.label}
                    </Button>
                  ))}
                </div>

                {/* Free-form question */}
                <div className="flex items-center gap-2">
                  <input
                    value={customQuestion}
                    onChange={e => setCustomQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAsk()}
                    placeholder="Ask anything about this image..."
                    disabled={isProcessing}
                    className="flex-1 h-8 border border-border bg-card px-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-50 rounded-lg"
                  />
                  <Button
                    size="sm"
                    disabled={!customQuestion.trim() || isProcessing}
                    onClick={handleAsk}
                    className="h-8 w-8 p-0 rounded-lg"
                  >
                    {isProcessing && activeTask === 'ask' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl"
                >
                  <p className="text-sm text-destructive">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results */}
            <div className="space-y-3">
              {results.map((r, idx) => (
                <motion.div
                  key={r.timestamp}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 bg-card border border-border ${
                    themeName === 'nebula' ? 'rounded-xl border-l-2 border-l-indigo-500/40' :
                    themeName === 'slate' ? 'rounded-xl border-l-2 border-l-teal-500/30' :
                    'rounded-xl border-l-2 border-l-amber-600/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="eyebrow">
                        {r.task === 'ask' ? 'Q&A' : VISION_TASKS.find(t => t.id === r.task)?.label || r.task}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        {r.model}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleCopy(idx)} className="h-6 px-1.5 text-xs">
                        {copied === idx ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => runVisionTask(r.task)}
                        disabled={isProcessing}
                        className="h-6 px-1.5 text-xs"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

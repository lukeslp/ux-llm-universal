// ============================================================
// AltTextPanel — Image description via vision-capable providers
// Only shows providers that support 'vision' capability
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { Upload, Eye, Loader2, AlertTriangle, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useChat } from '@/contexts/ChatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiUrl } from '@/lib/api-base';
import { motion } from 'framer-motion';

export default function AltTextPanel() {
  const { themeName } = useTheme();
  const { state } = useChat();

  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [altText, setAltText] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Filter to providers with vision capability
  const visionProviders = useMemo(
    () => state.providers.filter(p => p.capabilities?.includes('vision') && p.visionModels?.length),
    [state.providers],
  );

  const [selectedProvider, setSelectedProvider] = useState<string>(() =>
    visionProviders[0]?.id || '',
  );
  const currentProvider = visionProviders.find(p => p.id === selectedProvider) || visionProviders[0];
  const [selectedModel, setSelectedModel] = useState<string>(() =>
    currentProvider?.visionDefault || currentProvider?.visionModels?.[0] || '',
  );

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
      setAltText(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const generateAltText = useCallback(async () => {
    if (!imageBase64 || !selectedProvider || !selectedModel) return;
    setIsProcessing(true);
    setError(null);
    setAltText(null);

    try {
      // Use the dreamer streaming chat endpoint with a vision prompt
      const res = await fetch(apiUrl('/api/dreamer/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Describe this image in detail for use as alt text. Be comprehensive but concise. Include the main subject, composition, colors, text if any, and relevant context. Return only the description, no preamble.',
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${imageBase64}` },
                },
              ],
            },
          ],
          stream: false,
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error || `Vision request failed (${res.status})`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content
        || data.content?.[0]?.text
        || data.message?.content
        || data.text
        || 'No description generated';
      setAltText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate alt text');
    } finally {
      setIsProcessing(false);
    }
  }, [imageBase64, selectedProvider, selectedModel]);

  const handleCopy = async () => {
    if (!altText) return;
    await navigator.clipboard.writeText(altText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const noProviders = visionProviders.length === 0;

  return (
    <div className="flex-1 flex flex-col min-w-0">
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
              <p className="eyebrow mb-2">NO VISION PROVIDERS</p>
              <p className="text-sm">No providers with vision capability are configured.</p>
              <p className="text-xs text-muted-foreground/50 mt-2">
                Add an API key for Anthropic, OpenAI, xAI, Gemini, or Mistral in your server .env
              </p>
            </div>
          </div>
        ) : !image ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className={`w-16 h-16 flex items-center justify-center ${
              themeName === 'hearthstone' ? 'rounded-2xl bg-amber-900/20' :
              themeName === 'zurich' ? 'rounded-none border-2 border-border' :
              'rounded-2xl bg-indigo-900/20'
            }`}>
              <Eye className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="eyebrow mb-2">ALT TEXT GENERATION</p>
              <p className="text-sm">Upload an image to generate a description</p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                Using {currentProvider?.name || 'provider'} — {selectedModel}
              </p>
            </div>

            {/* Provider/model selectors */}
            <div className="flex items-center gap-2">
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

            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <Button variant="outline" asChild>
                <span className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Image
                </span>
              </Button>
            </label>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`overflow-hidden ${
                themeName === 'zurich' ? 'border-[3px] border-border' :
                themeName === 'nebula' ? 'rounded-xl border border-indigo-500/20' :
                'rounded-xl border border-border'
              }`}
            >
              <img src={image} alt="Uploaded for analysis" className="w-full h-auto" />
              <div className="p-2 flex items-center gap-2">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <Button variant="ghost" size="sm" asChild>
                    <span className="text-xs">Replace image</span>
                  </Button>
                </label>
              </div>
            </motion.div>

            {/* Description panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-4 bg-card border border-border flex flex-col gap-3 ${
                themeName === 'zurich' ? 'rounded-none border-[3px]' : 'rounded-xl'
              }`}
            >
              {/* Provider + model */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={selectedProvider} onValueChange={handleProviderChange}>
                  <SelectTrigger className="h-7 text-xs border-border/60 bg-transparent w-auto min-w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {visionProviders.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="h-7 text-xs border-border/60 bg-transparent w-auto min-w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(currentProvider?.visionModels || []).map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="eyebrow">DESCRIPTION</p>
              {isProcessing ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing image...
                </div>
              ) : altText ? (
                <div>
                  <p className="text-sm leading-relaxed">{altText}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs">
                      {copied ? <Check className="w-3 h-3 mr-1 text-green-500" /> : <Copy className="w-3 h-3 mr-1" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={generateAltText} className="h-7 px-2 text-xs">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Regenerate
                    </Button>
                  </div>
                </div>
              ) : error ? (
                <div>
                  <p className="text-sm text-destructive">{error}</p>
                  <Button variant="ghost" size="sm" onClick={generateAltText} className="h-7 px-2 text-xs mt-2">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground/60 italic">
                    Click Generate to create alt text
                  </p>
                  <Button onClick={generateAltText} size="sm" className="gap-2">
                    <Eye className="w-4 h-4" />
                    Generate Alt Text
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

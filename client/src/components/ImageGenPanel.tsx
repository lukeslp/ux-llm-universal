// ============================================================
// ImageGenPanel — Image generation prompt + gallery
// Theme-aware from start. Stub for future DALL-E/Flux integration.
// ============================================================

import { useState } from 'react';
import { Image as ImageIcon, Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';

export default function ImageGenPanel() {
  const { themeName } = useTheme();
  const [prompt, setPrompt] = useState('');
  const [isGenerating] = useState(false);
  const [generatedImages] = useState<string[]>([]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Gallery area */}
      <div className="flex-1 overflow-y-auto chat-scroll p-4">
        {generatedImages.length === 0 ? (
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
                Coming soon: DALL-E, Flux, SDXL
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {generatedImages.map((img, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`aspect-square overflow-hidden ${
                  themeName === 'zurich' ? 'border-2 border-border' :
                  themeName === 'nebula' ? 'rounded-xl border border-indigo-500/20' :
                  'rounded-xl border border-border'
                }`}
              >
                <img src={img} alt={`Generated ${i + 1}`} className="w-full h-full object-cover" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Prompt input */}
      <div className="border-t border-border bg-background/80 backdrop-blur-sm px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <div className="flex-1">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              rows={1}
              className={`w-full resize-none border border-border bg-card px-4 py-3 text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${
                themeName === 'zurich' ? 'rounded-none border-2' : 'rounded-xl'
              }`}
            />
          </div>
          <Button
            size="sm"
            disabled={!prompt.trim() || isGenerating}
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
  );
}

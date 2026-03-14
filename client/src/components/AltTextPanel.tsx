// ============================================================
// AltTextPanel — Image + description split view
// Theme-aware. Stub for vision model integration.
// ============================================================

import { useState } from 'react';
import { Upload, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';

export default function AltTextPanel() {
  const { themeName } = useTheme();
  const [image, setImage] = useState<string | null>(null);
  const [altText] = useState<string | null>(null);
  const [isProcessing] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex-1 overflow-y-auto chat-scroll p-4">
        {!image ? (
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
            </div>
            <label className={`cursor-pointer ${
              themeName === 'zurich' ? 'rounded-none' : 'rounded-xl'
            }`}>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <Button variant="outline" asChild>
                <span className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Image
                </span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground/50 mt-2">
              Coming soon: vision model via existing provider APIs
            </p>
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
            </motion.div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-4 bg-card border border-border flex flex-col gap-3 ${
                themeName === 'zurich' ? 'rounded-none border-[3px]' :
                'rounded-xl'
              }`}
            >
              <p className="eyebrow">DESCRIPTION</p>
              {isProcessing ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing image...
                </div>
              ) : altText ? (
                <p className="text-sm leading-relaxed">{altText}</p>
              ) : (
                <p className="text-sm text-muted-foreground/60 italic">
                  Alt text will appear here after processing
                </p>
              )}

              {/* Confidence meter placeholder */}
              <div className="mt-auto">
                <p className="eyebrow mb-1">CONFIDENCE</p>
                <div className={`h-2 bg-muted overflow-hidden ${
                  themeName === 'zurich' ? 'rounded-none' : 'rounded-full'
                }`}>
                  <div
                    className={`h-full transition-all ${
                      themeName === 'hearthstone' ? 'bg-amber-500' :
                      themeName === 'zurich' ? 'bg-foreground' :
                      'bg-indigo-500'
                    }`}
                    style={{ width: altText ? '85%' : '0%' }}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

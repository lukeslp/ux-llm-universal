// ============================================================
// Create Page — Image gen, video gen, TTS, provider comparison
// Route: /create
// ============================================================

import { useState } from 'react';
import { Image as ImageIcon, Video, AudioLines, Columns2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ImageGenPanel from '@/components/ImageGenPanel';

const TABS = [
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'tts', label: 'TTS', icon: AudioLines },
  { id: 'compare', label: 'Compare', icon: Columns2 },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CreatePage() {
  const [activeTab, setActiveTab] = useState<TabId>('image');

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-4 pt-3 pb-2 border-b border-border/30">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all rounded-lg',
                isActive
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'image' && <ImageGenPanel />}

        {activeTab === 'video' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <Video className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-semibold text-foreground/80 mb-1">Video Generation</h3>
              <p className="text-sm text-muted-foreground/60 max-w-sm">
                Generate videos from text prompts using AI providers. Coming in Phase 2.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'tts' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <AudioLines className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-semibold text-foreground/80 mb-1">Text to Speech</h3>
              <p className="text-sm text-muted-foreground/60 max-w-sm">
                Convert text to natural speech with multiple voices and providers. Coming in Phase 2.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <Columns2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-semibold text-foreground/80 mb-1">Provider Comparison</h3>
              <p className="text-sm text-muted-foreground/60 max-w-sm">
                Compare outputs from multiple providers side-by-side. Coming in Phase 2.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

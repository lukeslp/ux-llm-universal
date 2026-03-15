// ============================================================
// Create Page — Image gen, video gen, TTS, image edit, provider comparison
// Route: /create
// ============================================================

import { useState } from 'react';
import { Image as ImageIcon, Video, AudioLines, Columns2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import ImageGenPanel from '@/components/ImageGenPanel';
import VideoGenPanel from '@/components/VideoGenPanel';
import TTSPanel from '@/components/TTSPanel';
import ImageEditPanel from '@/components/ImageEditPanel';
import ProviderComparePanel from '@/components/ProviderComparePanel';

const TABS = [
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'tts', label: 'TTS', icon: AudioLines },
  { id: 'edit', label: 'Edit', icon: Pencil },
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
        {activeTab === 'video' && <VideoGenPanel />}
        {activeTab === 'tts' && <TTSPanel />}
        {activeTab === 'edit' && <ImageEditPanel />}
        {activeTab === 'compare' && <ProviderComparePanel />}
      </div>
    </div>
  );
}

// ============================================================
// PromptLibrary — Save/load reusable prompt templates
// Slide-out popover with category tabs
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Bookmark, Plus, Trash2, Loader2, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiUrl } from '@/lib/api-base';
import { cn } from '@/lib/utils';

interface SavedPrompt {
  id: number;
  category: string;
  name: string;
  prompt: string;
  useCount: number;
}

interface PromptLibraryProps {
  category: string;
  currentPrompt?: string;
  onSelectPrompt: (prompt: string) => void;
}

export default function PromptLibrary({ category, currentPrompt, onSelectPrompt }: PromptLibraryProps) {
  const [open, setOpen] = useState(false);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    try {
      // Use tRPC endpoint via fetch (simpler than importing tRPC client)
      const res = await fetch(apiUrl(`/api/trpc/prompts.list?input=${encodeURIComponent(JSON.stringify({ json: { category } }))}`));
      const data = await res.json();
      if (data?.result?.data?.json) {
        setPrompts(data.result.data.json);
      }
    } catch {
      // Silently fail — library is optional
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    if (open) fetchPrompts();
  }, [open, fetchPrompts]);

  const handleSave = async () => {
    if (!saveName.trim() || !currentPrompt?.trim()) return;
    try {
      await fetch(apiUrl('/api/trpc/prompts.save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: { category, name: saveName.trim(), prompt: currentPrompt.trim() },
        }),
      });
      setSaveName('');
      setShowSave(false);
      fetchPrompts();
    } catch {}
  };

  const handleUse = async (prompt: SavedPrompt) => {
    onSelectPrompt(prompt.prompt);
    // Track usage
    try {
      await fetch(apiUrl('/api/trpc/prompts.use'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { id: prompt.id } }),
      });
    } catch {}
    setOpen(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(apiUrl('/api/trpc/prompts.delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { id } }),
      });
      setPrompts(prev => prev.filter(p => p.id !== id));
    } catch {}
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'h-7 w-7 flex items-center justify-center rounded-md transition-colors',
          open ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )}
        title="Prompt Library"
      >
        <Bookmark className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Popover */}
          <div className="absolute bottom-full mb-2 right-0 w-72 max-h-[400px] bg-popover border border-border rounded-xl shadow-lg z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
              <span className="text-xs font-medium">Prompt Library</span>
              <div className="flex items-center gap-1">
                {currentPrompt?.trim() && (
                  <button
                    onClick={() => setShowSave(!showSave)}
                    className="h-6 px-2 flex items-center gap-1 text-[10px] rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Save
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Save form */}
            {showSave && currentPrompt?.trim() && (
              <div className="px-3 py-2 border-b border-border/30 flex items-center gap-2">
                <Input
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="Name..."
                  className="h-7 text-xs"
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
                <Button size="sm" className="h-7 text-xs px-2" onClick={handleSave}>
                  Save
                </Button>
              </div>
            )}

            {/* Prompt list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : prompts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                  <Bookmark className="w-5 h-5 mb-2" />
                  <p className="text-xs">No saved prompts</p>
                  <p className="text-[10px] mt-0.5">Save a prompt to reuse it later</p>
                </div>
              ) : (
                <div className="py-1">
                  {prompts.map(p => (
                    <div
                      key={p.id}
                      className="group px-3 py-2 hover:bg-muted/50 cursor-pointer flex items-start gap-2"
                      onClick={() => handleUse(p)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground/60 line-clamp-2 mt-0.5">{p.prompt}</p>
                        {p.useCount > 0 && (
                          <span className="text-[9px] text-muted-foreground/40">Used {p.useCount}x</span>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                        className="h-5 w-5 shrink-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

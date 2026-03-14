// ============================================================
// ManusTaskInput — Task submission form
// Large textarea, model selector with descriptions, file drop zone, Launch Task button
// ============================================================

import { useState, useRef, useCallback } from 'react';
import { Rocket, Paperclip, X, Zap, Scale, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useChat } from '@/contexts/ChatContext';

interface Props {
  isRunning?: boolean;
}

interface ManusModelOption {
  id: string;
  label: string;
  description: string;
  complexity: number;
  icon: typeof Zap;
}

const MANUS_MODELS: ManusModelOption[] = [
  {
    id: 'manus-1.6-lite',
    label: 'Lite',
    description: 'Fast — quick tasks, drafts',
    complexity: 1,
    icon: Zap,
  },
  {
    id: 'manus-1.6',
    label: 'Standard',
    description: 'Balanced — most tasks',
    complexity: 2,
    icon: Scale,
  },
  {
    id: 'manus-1.6-max',
    label: 'Max',
    description: 'Thorough — complex research',
    complexity: 3,
    icon: Search,
  },
];

function ComplexityBars({ level }: { level: number }) {
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-sm transition-colors',
            i <= level ? 'bg-violet-500' : 'bg-gray-200 dark:bg-gray-700',
          )}
          style={{ height: `${33 * i}%` }}
        />
      ))}
    </div>
  );
}

export default function ManusTaskInput({ isRunning }: Props) {
  const { submitManusTask } = useChat();
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('manus-1.6');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentModel = MANUS_MODELS.find(m => m.id === selectedModel) || MANUS_MODELS[1];

  const handleSubmit = async () => {
    if (!prompt.trim() || isSubmitting || isRunning) return;

    setIsSubmitting(true);
    try {
      await submitManusTask(prompt.trim(), selectedModel);
      setPrompt('');
      setFiles([]);
    } catch {
      // Error is handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...dropped].slice(0, 5));
  }, []);

  const removeFile = (i: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  };

  const disabled = isRunning || isSubmitting;

  return (
    <div className="space-y-4">
      {/* Prompt textarea */}
      <div
        className={cn(
          'rounded-2xl border transition-all duration-200',
          isDragging
            ? 'border-violet-400 bg-violet-50/50 dark:bg-violet-950/20'
            : 'border-border bg-card',
          disabled ? 'opacity-60' : '',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your project or task... (Ctrl+Enter to submit)"
          className="min-h-28 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm rounded-2xl p-4 pb-2"
          disabled={disabled}
        />

        {/* Files */}
        {files.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 text-xs text-muted-foreground"
              >
                <Paperclip className="w-2.5 h-2.5" />
                <span className="max-w-32 truncate">{f.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="hover:text-destructive transition-colors ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors disabled:cursor-not-allowed"
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>Attach files</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => {
              const picked = Array.from(e.target.files || []);
              setFiles(prev => [...prev, ...picked].slice(0, 5));
              e.target.value = '';
            }}
          />
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || disabled}
            className={cn(
              'h-8 px-4 gap-2 text-sm font-medium rounded-xl transition-all',
              'bg-violet-600 hover:bg-violet-700 text-white',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Launching…
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5" />
                Launch Task
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Model selector */}
      <div>
        <p className="text-xs font-medium text-muted-foreground/60 mb-2 px-1">Model</p>
        <div className="grid grid-cols-3 gap-2">
          {MANUS_MODELS.map(model => {
            const Icon = model.icon;
            const isSelected = selectedModel === model.id;
            return (
              <button
                key={model.id}
                onClick={() => !disabled && setSelectedModel(model.id)}
                disabled={disabled}
                className={cn(
                  'flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all',
                  isSelected
                    ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30'
                    : 'border-border hover:border-violet-200 dark:hover:border-violet-800 hover:bg-accent/30',
                  disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      isSelected ? 'text-violet-500' : 'text-muted-foreground',
                    )}
                  />
                  <ComplexityBars level={model.complexity} />
                </div>
                <p
                  className={cn(
                    'text-sm font-semibold',
                    isSelected ? 'text-violet-700 dark:text-violet-300' : 'text-foreground',
                  )}
                >
                  {model.label}
                </p>
                <p className="text-xs text-muted-foreground/60 leading-tight">{model.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {isRunning && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50">
          <div className="w-3.5 h-3.5 border-2 border-violet-400/50 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-xs text-violet-700 dark:text-violet-300">A task is currently running. Wait for it to complete before launching another.</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ChatInput — Message input with send, stop, and attachments
// Design: Warm Companion — large, inviting input area
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Square, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/contexts/ChatContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatInput() {
  const { sendMessage, stopGeneration, state } = useChat();
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isGenerating } = state;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Focus textarea on mount
  useEffect(() => {
    if (state.isConnected && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [state.isConnected, state.activeConversationId]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed && images.length === 0) return;
    if (isGenerating) return;

    sendMessage(trimmed, images.length > 0 ? images : undefined);
    setInput('');
    setImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, [input, images, isGenerating, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const processFiles = (files: FileList | File[]) => {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setImages(prev => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div
      className={`border-t border-border bg-background/80 backdrop-blur-sm px-4 py-3 transition-colors ${
        dragOver ? 'bg-primary/5 border-primary/30' : ''
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="max-w-3xl mx-auto">
        {/* Generating indicator */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center gap-2 mb-2 text-xs text-muted-foreground"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Generating response...</span>
              <button
                onClick={stopGeneration}
                className="text-destructive hover:underline ml-auto"
              >
                Stop
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image previews */}
        <AnimatePresence>
          {images.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-2 mb-3"
            >
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img
                    src={`data:image/png;base64,${img}`}
                    alt="Upload preview"
                    className="w-16 h-16 rounded-lg object-cover border border-border"
                  />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag overlay hint */}
        {dragOver && (
          <div className="flex items-center justify-center py-3 mb-2 border-2 border-dashed border-primary/50 rounded-xl bg-primary/5">
            <p className="eyebrow text-primary/70">DROP IMAGES HERE</p>
          </div>
        )}

        {/* Input area */}
        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => fileInputRef.current?.click()}
            title="Attach an image"
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                state.isConnected
                  ? 'Type your message... (/ to focus)'
                  : 'Connect to Ollama to start chatting...'
              }
              disabled={!state.isConnected && !isGenerating}
              rows={1}
              className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ maxHeight: '200px' }}
            />
          </div>

          {/* Send / Stop button */}
          {isGenerating ? (
            <Button
              onClick={stopGeneration}
              size="sm"
              variant="destructive"
              className="h-10 w-10 shrink-0 rounded-full p-0"
              title="Stop generating"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              size="sm"
              disabled={(!input.trim() && images.length === 0) || !state.isConnected}
              className="h-10 w-10 shrink-0 rounded-full p-0 bg-primary hover:bg-primary/90 disabled:opacity-40"
              title="Send message (Enter)"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Helper text */}
        <div className="flex items-center justify-center gap-3 mt-2">
          <p className="text-[11px] text-muted-foreground/40">
            Enter to send · Shift+Enter for new line · Drag & drop images
          </p>
        </div>
      </div>
    </div>
  );
}

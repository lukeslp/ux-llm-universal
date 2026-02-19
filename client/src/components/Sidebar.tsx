// ============================================================
// Sidebar — Conversation history & navigation
// Design: Warm Companion — clean, simple conversation list
// ============================================================

import { Plus, MessageSquare, Trash2, X, HelpCircle, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat } from '@/contexts/ChatContext';
import { cn } from '@/lib/utils';

interface Props {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: Props) {
  const { state, dispatch, createConversation, deleteConversation } = useChat();

  const handleNewChat = () => {
    createConversation();
    onClose?.();
  };

  const handleSelectConversation = (id: string) => {
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: id });
    onClose?.();
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group conversations by date
  const grouped = state.conversations.reduce<Record<string, typeof state.conversations>>(
    (acc, conv) => {
      const label = formatDate(conv.updatedAt);
      if (!acc[label]) acc[label] = [];
      acc[label].push(conv);
      return acc;
    },
    {}
  );

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-rose-400 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <h2 className="font-semibold text-base">Chats</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="h-8 w-8 p-0 rounded-full hover:bg-sidebar-accent"
            title="New chat"
          >
            <Plus className="w-4 h-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-full hover:bg-sidebar-accent lg:hidden"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {state.conversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground/60">
                No conversations yet
              </p>
              <p className="text-xs text-muted-foreground/40 mt-1">
                Start a new chat to begin
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([label, convs]) => (
              <div key={label} className="mb-3">
                <p className="text-xs font-medium text-muted-foreground/60 px-3 py-1 uppercase tracking-wider">
                  {label}
                </p>
                {convs.map(conv => (
                  <div
                    key={conv.id}
                    className={cn(
                      'group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors',
                      conv.id === state.activeConversationId
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'hover:bg-sidebar-accent/50'
                    )}
                    onClick={() => handleSelectConversation(conv.id)}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground/60 truncate">
                        {conv.messages.length} message{conv.messages.length !== 1 ? 's' : ''}
                        {conv.model ? ` · ${conv.model}` : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={e => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      title="Delete chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 h-10 rounded-xl text-sm font-medium"
          onClick={handleNewChat}
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>

        {/* Help links */}
        <div className="flex items-center justify-center gap-3 pt-1">
          <a
            href="https://lukesteuber.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
          >
            <HelpCircle className="w-3 h-3" />
            <span>lukesteuber.com</span>
          </a>
          <span className="text-muted-foreground/20">·</span>
          <a
            href="https://dr.eamer.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
          >
            <span>dr.eamer.dev</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

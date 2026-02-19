// ============================================================
// Home — Main chat page layout
// Design: Warm Companion — clean, responsive chat layout
// ============================================================

import { useRef, useEffect, useMemo, useState } from 'react';
import { Menu, Settings, Sparkles, Plus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { AnimatePresence, motion } from 'framer-motion';
import { useChat } from '@/contexts/ChatContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import Sidebar from '@/components/Sidebar';
import SettingsPanel from '@/components/SettingsPanel';
import EmptyState from '@/components/EmptyState';
import ConnectionStatus from '@/components/ConnectionStatus';

export default function Home() {
  const { state, dispatch, activeConversation, createConversation } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation?.messages]);

  // Track scroll position for "scroll to bottom" button
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollDown(scrollHeight - scrollTop - clientHeight > 200);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeConversation?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewChat: createConversation,
    onToggleSidebar: () => dispatch({ type: 'TOGGLE_SIDEBAR' }),
    onToggleSettings: () => dispatch({ type: 'TOGGLE_SETTINGS' }),
    onFocusInput: () => {
      const textarea = document.querySelector('textarea');
      textarea?.focus();
    },
  });

  const messages = activeConversation?.messages || [];
  const hasMessages = messages.length > 0;

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-72 shrink-0 border-r border-border">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet
        open={state.sidebarOpen}
        onOpenChange={open => dispatch({ type: 'SET_SIDEBAR', payload: open })}
      >
        <SheetContent side="left" className="p-0 w-80">
          <SheetTitle className="sr-only">Chat History</SheetTitle>
          <SheetDescription className="sr-only">Your conversation history</SheetDescription>
          <Sidebar onClose={() => dispatch({ type: 'SET_SIDEBAR', payload: false })} />
        </SheetContent>
      </Sheet>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm shrink-0 z-10">
          <div className="flex items-center gap-2">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden h-9 w-9 p-0 rounded-full"
              onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* App title */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-rose-400 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold leading-tight">Ollama Chat</h1>
                <p className="text-xs text-muted-foreground leading-tight">
                  {state.settings.defaultModel}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <ConnectionStatus />
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 rounded-full"
              onClick={createConversation}
              title="New chat (Ctrl+N)"
            >
              <Plus className="w-4.5 h-4.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 rounded-full"
              onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
              title="Settings (Ctrl+,)"
            >
              <Settings className="w-4.5 h-4.5" />
            </Button>
          </div>
        </header>

        {/* Chat + Settings split */}
        <div className="flex-1 flex min-h-0">
          {/* Messages area */}
          <div className="flex-1 flex flex-col min-w-0 relative">
            {hasMessages ? (
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto chat-scroll"
              >
                <div className="py-4">
                  {messages.map((msg, i) => (
                    <div key={msg.id} className="group">
                      <ChatMessage
                        message={msg}
                        isLast={i === messages.length - 1}
                      />
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            ) : (
              <EmptyState />
            )}

            {/* Scroll to bottom button */}
            <AnimatePresence>
              {showScrollDown && hasMessages && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={scrollToBottom}
                    className="rounded-full shadow-md bg-card h-8 px-3 gap-1"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span className="text-xs">Scroll down</span>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error banner */}
            {state.error && (
              <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
                <p className="text-sm text-destructive text-center max-w-3xl mx-auto">
                  {state.error}
                </p>
              </div>
            )}

            {/* Input */}
            <ChatInput />
          </div>

          {/* Settings Panel — Desktop */}
          <AnimatePresence>
            {state.settingsOpen && !isMobile && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 overflow-hidden"
              >
                <div className="w-80 h-full">
                  <SettingsPanel />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Settings Panel — Mobile Sheet */}
          {isMobile && (
            <Sheet
              open={state.settingsOpen}
              onOpenChange={open => dispatch({ type: 'SET_SETTINGS_OPEN', payload: open })}
            >
              <SheetContent side="right" className="p-0 w-full sm:w-96">
                <SheetTitle className="sr-only">Settings</SheetTitle>
                <SheetDescription className="sr-only">Configure your chat settings</SheetDescription>
                <SettingsPanel />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </div>
  );
}

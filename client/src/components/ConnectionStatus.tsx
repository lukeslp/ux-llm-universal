// ============================================================
// ConnectionStatus — Shows Ollama connection state
// Design: Warm Companion — friendly status indicators
// ============================================================

import { useChat } from '@/contexts/ChatContext';
import { cn } from '@/lib/utils';

export default function ConnectionStatus() {
  const { state } = useChat();

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors',
        state.isConnected
          ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/40'
          : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/40'
      )}
    >
      <div
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          state.isConnected ? 'bg-green-500' : 'bg-red-400 animate-pulse'
        )}
      />
      <span className="font-medium hidden sm:inline">
        {state.isConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
}

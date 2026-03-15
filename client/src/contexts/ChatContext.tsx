// ============================================================
// Chat Context — Compatibility layer
// Re-exports from decomposed contexts (Provider, Settings, Tool, Conversation)
// Existing components can still use useChat() during migration
// ============================================================

import React, { useMemo } from 'react';
import { useConversation } from './ConversationContext';
import { useSettings } from './SettingsContext';
import { useProviders } from './ProviderContext';
import { useTools } from './ToolContext';
import type { AppSettings } from '@/lib/types';

// Re-export the provider for App.tsx backward compat
// This is now a no-op wrapper — real providers are in App.tsx
export function ChatProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Compatibility hook — maps new context shape to old ChatState shape
export function useChat() {
  const { state: convState, dispatch: convDispatch, ...convActions } = useConversation();
  const { settings, updateSettings, settingsOpen, setSettingsOpen } = useSettings();
  const { providers, models, isConnected, error: providerError, refreshProviders, refreshModels, checkConnection } = useProviders();
  const { toolRegistry, toolSchemas, refreshTools } = useTools();

  // Build a dispatch that handles all old action types
  const dispatch = useMemo(() => {
    return (action: { type: string; payload?: unknown }) => {
      switch (action.type) {
        case 'SET_SETTINGS':
          updateSettings(action.payload as Partial<AppSettings>);
          break;
        case 'TOGGLE_SIDEBAR':
          // Sidebar is now managed in AppShell — this is a no-op
          break;
        case 'SET_SIDEBAR':
          // Sidebar is now managed in AppShell — this is a no-op
          break;
        case 'TOGGLE_SETTINGS':
          setSettingsOpen(!settingsOpen);
          break;
        case 'SET_SETTINGS_OPEN':
          setSettingsOpen(action.payload as boolean);
          break;
        default:
          // Forward conversation-related actions
          convDispatch(action as Parameters<typeof convDispatch>[0]);
      }
    };
  }, [convDispatch, updateSettings, setSettingsOpen, settingsOpen]);

  // Compose the old ChatState shape
  const state = useMemo(() => ({
    conversations: convState.conversations,
    activeConversationId: convState.activeConversationId,
    settings,
    models,
    providers,
    isConnected,
    isGenerating: convState.isGenerating,
    error: convState.error || providerError,
    sidebarOpen: false, // managed in AppShell now
    settingsOpen,
    toolRegistry,
    toolSchemas,
    manusTasks: convState.manusTasks,
    activeManusTaskId: convState.activeManusTaskId,
  }), [convState, settings, models, providers, isConnected, providerError, settingsOpen, toolRegistry, toolSchemas]);

  return {
    state,
    dispatch,
    sendMessage: convActions.sendMessage,
    createConversation: convActions.createConversation,
    deleteConversation: convActions.deleteConversation,
    stopGeneration: convActions.stopGeneration,
    refreshModels,
    refreshProviders,
    refreshTools,
    checkConnection,
    activeConversation: convActions.activeConversation,
    submitManusTask: convActions.submitManusTask,
    cancelManusTask: convActions.cancelManusTask,
    refreshManusTask: convActions.refreshManusTask,
  };
}

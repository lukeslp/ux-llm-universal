// ============================================================
// Provider Context — Provider/model discovery and connection state
// Extracted from ChatContext for focused state management
// ============================================================

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { OllamaModel } from '@/lib/types';
import { ollamaClient } from '@/lib/ollama-client';
import { fetchProviders } from '@/lib/dreamer-client';
import type { Provider } from '@/lib/dreamer-client';
import { useSettings } from './SettingsContext';

interface ProviderState {
  providers: Provider[];
  models: OllamaModel[];
  isConnected: boolean;
  error: string | null;
}

type ProviderAction =
  | { type: 'SET_PROVIDERS'; payload: Provider[] }
  | { type: 'SET_MODELS'; payload: OllamaModel[] }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

function providerReducer(state: ProviderState, action: ProviderAction): ProviderState {
  switch (action.type) {
    case 'SET_PROVIDERS':
      return { ...state, providers: action.payload };
    case 'SET_MODELS':
      return { ...state, models: action.payload };
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

interface ProviderContextType {
  providers: Provider[];
  models: OllamaModel[];
  isConnected: boolean;
  error: string | null;
  refreshProviders: () => Promise<void>;
  refreshModels: () => Promise<void>;
  checkConnection: () => Promise<void>;
}

const ProviderContext = createContext<ProviderContextType | undefined>(undefined);

export function ProviderProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [state, dispatch] = useReducer(providerReducer, {
    providers: [],
    models: [],
    isConnected: false,
    error: null,
  });

  const checkConnection = useCallback(async () => {
    const connected = await ollamaClient.checkConnection();
    dispatch({ type: 'SET_CONNECTED', payload: connected });
    if (connected) {
      dispatch({ type: 'SET_ERROR', payload: null });
    }
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      const models = await ollamaClient.listModels();
      dispatch({ type: 'SET_MODELS', payload: models });
    } catch {
      dispatch({ type: 'SET_MODELS', payload: [] });
    }
  }, []);

  const refreshProviders = useCallback(async () => {
    try {
      const providers = await fetchProviders();
      dispatch({ type: 'SET_PROVIDERS', payload: providers });
    } catch {
      dispatch({ type: 'SET_PROVIDERS', payload: [] });
    }
  }, []);

  // Sync ollama client config when settings change
  useEffect(() => {
    ollamaClient.configure({
      baseUrl: settings.ollamaUrl,
      connectionMode: settings.connectionMode,
    });
  }, [settings.ollamaUrl, settings.connectionMode]);

  // Initialize on mount
  useEffect(() => {
    checkConnection();
    refreshModels();
    refreshProviders();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection, refreshModels, refreshProviders]);

  return (
    <ProviderContext.Provider
      value={{
        ...state,
        refreshProviders,
        refreshModels,
        checkConnection,
      }}
    >
      {children}
    </ProviderContext.Provider>
  );
}

export function useProviders() {
  const ctx = useContext(ProviderContext);
  if (!ctx) throw new Error('useProviders must be used within ProviderProvider');
  return ctx;
}

// ============================================================
// Settings Context — App settings with localStorage persistence
// Extracted from ChatContext for focused state management
// ============================================================

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AppSettings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';

const SETTINGS_KEY = 'ollama-chat-settings';

function loadSettings(): AppSettings {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return DEFAULT_SETTINGS;
    const stored: Partial<AppSettings> = JSON.parse(data);
    // Ensure defaultModel is always glm-5 regardless of stored settings
    stored.defaultModel = 'glm-5';
    // Strip legacy 'mode' field if present
    delete (stored as Record<string, unknown>).mode;
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or unavailable
  }
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  // UI state — lightweight, no need for separate context
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Persist on change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, settingsOpen, setSettingsOpen }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

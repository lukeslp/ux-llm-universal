// ============================================================
// Tool Context — Tool registry and schema management
// Extracted from ChatContext for focused state management
// ============================================================

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { OllamaTool } from '@/lib/types';
import {
  getToolSchemas,
  fetchToolRegistry,
  type ToolRegistry,
} from '@/lib/tool-service';
import { useSettings } from './SettingsContext';

interface ToolContextType {
  toolRegistry: ToolRegistry | null;
  toolSchemas: OllamaTool[];
  refreshTools: () => Promise<void>;
}

const ToolContext = createContext<ToolContextType | undefined>(undefined);

export function ToolProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [toolRegistry, setToolRegistry] = useState<ToolRegistry | null>(null);
  const [toolSchemas, setToolSchemas] = useState<OllamaTool[]>([]);

  const refreshTools = useCallback(async () => {
    try {
      const registry = await fetchToolRegistry();
      setToolRegistry(registry);

      const enabledModules = settings.enabledToolModules.length > 0
        ? new Set(settings.enabledToolModules)
        : undefined;
      const schemas = await getToolSchemas(enabledModules);
      setToolSchemas(schemas);
    } catch {
      // Silently fail — builtins still work
    }
  }, [settings.enabledToolModules]);

  // Fetch on mount and when enabled modules change
  useEffect(() => {
    refreshTools();
  }, [refreshTools]);

  return (
    <ToolContext.Provider value={{ toolRegistry, toolSchemas, refreshTools }}>
      {children}
    </ToolContext.Provider>
  );
}

export function useTools() {
  const ctx = useContext(ToolContext);
  if (!ctx) throw new Error('useTools must be used within ToolProvider');
  return ctx;
}

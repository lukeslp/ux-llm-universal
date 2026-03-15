// ============================================================
// Artifact Context — Unified artifact tracking with server persistence
// Stores generated images, audio, documents, research reports
// Optimistic local state + async sync to tRPC artifacts router
// ============================================================

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { apiUrl } from '@/lib/api-base';

export type ArtifactType = 'image' | 'video' | 'audio' | 'document' | 'report';

export interface Artifact {
  id: string;
  serverId?: number; // DB id when persisted
  type: ArtifactType;
  url: string;
  prompt?: string;
  provider?: string;
  model?: string;
  metadata?: Record<string, unknown>;
  isFavorite: boolean;
  collectionId?: string;
  createdAt: number;
}

interface ArtifactContextType {
  artifacts: Artifact[];
  favorites: Set<string>;
  loading: boolean;
  saveArtifact: (artifact: Omit<Artifact, 'id' | 'isFavorite' | 'createdAt'>) => string;
  removeArtifact: (id: string) => void;
  toggleFavorite: (id: string) => void;
  getByType: (type: ArtifactType) => Artifact[];
  refreshFromServer: () => Promise<void>;
}

const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined);

// tRPC mutation helper — returns parsed result or null
async function trpcMutate(path: string, input: unknown): Promise<unknown> {
  try {
    const res = await fetch(apiUrl(`/api/trpc/${path}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: input }),
    });
    const data = await res.json();
    return data?.result?.data?.json ?? null;
  } catch {
    return null;
  }
}

// tRPC query helper
async function trpcQuery(path: string, input: unknown): Promise<unknown> {
  try {
    const res = await fetch(
      apiUrl(`/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`),
    );
    const data = await res.json();
    return data?.result?.data?.json;
  } catch {
    return null;
  }
}

export function ArtifactProvider({ children }: { children: React.ReactNode }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const hasLoaded = useRef(false);

  // Load from server on mount
  const refreshFromServer = useCallback(async () => {
    setLoading(true);
    try {
      const data = await trpcQuery('artifacts.list', { limit: 100, offset: 0 }) as { items: any[]; total: number } | null;
      if (data?.items) {
        const serverArtifacts: Artifact[] = data.items.map((item: any) => ({
          id: `srv_${item.id}`,
          serverId: item.id,
          type: item.type,
          url: item.url,
          prompt: item.prompt || undefined,
          provider: item.provider || undefined,
          model: item.model || undefined,
          metadata: item.metadata ? JSON.parse(item.metadata) : undefined,
          isFavorite: item.isFavorite === 1,
          createdAt: new Date(item.createdAt).getTime(),
        }));

        setArtifacts(prev => {
          // Merge: keep local-only artifacts, replace server-backed ones
          const localOnly = prev.filter(a => !a.serverId);
          return [...localOnly, ...serverArtifacts].sort((a, b) => b.createdAt - a.createdAt);
        });

        const favSet = new Set<string>();
        serverArtifacts.filter(a => a.isFavorite).forEach(a => favSet.add(a.id));
        setFavorites(prev => {
          const merged = new Set(prev);
          favSet.forEach(id => merged.add(id));
          return merged;
        });
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      refreshFromServer();
    }
  }, [refreshFromServer]);

  const saveArtifact = useCallback((artifact: Omit<Artifact, 'id' | 'isFavorite' | 'createdAt'>) => {
    const id = `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const full: Artifact = {
      ...artifact,
      id,
      isFavorite: false,
      createdAt: Date.now(),
    };
    setArtifacts(prev => [full, ...prev]);

    // Persist to server async — use returned ID directly (no race condition)
    trpcMutate('artifacts.save', {
      type: artifact.type,
      url: artifact.url,
      prompt: artifact.prompt,
      provider: artifact.provider,
      model: artifact.model,
      metadata: artifact.metadata ? JSON.stringify(artifact.metadata) : undefined,
    }).then((result) => {
      const serverId = (result as { id?: number } | null)?.id;
      if (serverId) {
        setArtifacts(prev => prev.map(a =>
          a.id === id ? { ...a, serverId } : a,
        ));
      }
    });

    return id;
  }, []);

  const removeArtifact = useCallback((id: string) => {
    setArtifacts(prev => {
      const artifact = prev.find(a => a.id === id);
      if (artifact?.serverId) {
        trpcMutate('artifacts.delete', { id: artifact.serverId });
      }
      return prev.filter(a => a.id !== id);
    });
    setFavorites(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setArtifacts(prev => {
      const artifact = prev.find(a => a.id === id);
      if (artifact?.serverId) {
        trpcMutate('artifacts.toggleFavorite', { id: artifact.serverId });
      }
      return prev.map(a =>
        a.id === id ? { ...a, isFavorite: !a.isFavorite } : a,
      );
    });
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const getByType = useCallback((type: ArtifactType) => {
    return artifacts.filter(a => a.type === type);
  }, [artifacts]);

  return (
    <ArtifactContext.Provider value={{
      artifacts, favorites, loading,
      saveArtifact, removeArtifact, toggleFavorite, getByType,
      refreshFromServer,
    }}>
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifacts() {
  const ctx = useContext(ArtifactContext);
  if (!ctx) throw new Error('useArtifacts must be used within ArtifactProvider');
  return ctx;
}

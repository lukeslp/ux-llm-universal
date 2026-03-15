// ============================================================
// Artifact Context — Unified artifact tracking across all surfaces
// Stores generated images, audio, documents, research reports
// ============================================================

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ArtifactType = 'image' | 'video' | 'audio' | 'document' | 'report';

export interface Artifact {
  id: string;
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
  saveArtifact: (artifact: Omit<Artifact, 'id' | 'isFavorite' | 'createdAt'>) => string;
  removeArtifact: (id: string) => void;
  toggleFavorite: (id: string) => void;
  getByType: (type: ArtifactType) => Artifact[];
}

const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined);

export function ArtifactProvider({ children }: { children: React.ReactNode }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const saveArtifact = useCallback((artifact: Omit<Artifact, 'id' | 'isFavorite' | 'createdAt'>) => {
    const id = `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const full: Artifact = {
      ...artifact,
      id,
      isFavorite: false,
      createdAt: Date.now(),
    };
    setArtifacts(prev => [full, ...prev]);
    return id;
  }, []);

  const removeArtifact = useCallback((id: string) => {
    setArtifacts(prev => prev.filter(a => a.id !== id));
    setFavorites(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setArtifacts(prev => prev.map(a =>
      a.id === id ? { ...a, isFavorite: !a.isFavorite } : a
    ));
  }, []);

  const getByType = useCallback((type: ArtifactType) => {
    return artifacts.filter(a => a.type === type);
  }, [artifacts]);

  return (
    <ArtifactContext.Provider value={{ artifacts, favorites, saveArtifact, removeArtifact, toggleFavorite, getByType }}>
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifacts() {
  const ctx = useContext(ArtifactContext);
  if (!ctx) throw new Error('useArtifacts must be used within ArtifactProvider');
  return ctx;
}

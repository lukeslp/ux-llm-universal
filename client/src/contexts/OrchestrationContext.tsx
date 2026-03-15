// ============================================================
// Orchestration Context — Beltalowda SSE connection + task state
// Manages multi-agent research tasks via SSE bridge
// ============================================================

import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api-base';

// Agent state tracked per-agent
export interface AgentState {
  id: string;
  type: 'belter' | 'drummer' | 'camina';
  status: 'pending' | 'running' | 'complete' | 'error';
  task?: string;
  name?: string;
  progress: number;
  description?: string;
  preview?: string; // First ~100 chars of content
  index?: number;
}

export interface ResearchTask {
  id: string;
  prompt: string;
  provider: string;
  model: string;
  agentCount: number;
  status: 'starting' | 'decomposing' | 'running' | 'synthesizing' | 'complete' | 'error' | 'cancelled';
  agents: Map<string, AgentState>;
  decomposition?: string[];
  artifacts: Array<{
    agentType: string;
    agentId: string;
    filename: string;
    downloadPath: string;
  }>;
  executionTime?: number;
  totalCost?: number;
  caminaContent?: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

interface OrchestrationContextType {
  activeTask: ResearchTask | null;
  taskHistory: ResearchTask[];
  startResearch: (prompt: string, provider: string, model: string, agentCount: number) => Promise<void>;
  cancelResearch: () => void;
}

const OrchestrationContext = createContext<OrchestrationContextType | undefined>(undefined);

export function OrchestrationProvider({ children }: { children: React.ReactNode }) {
  const [activeTask, setActiveTask] = useState<ResearchTask | null>(null);
  const [taskHistory, setTaskHistory] = useState<ResearchTask[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const updateAgent = useCallback((taskId: string, agentId: string, updates: Partial<AgentState>) => {
    setActiveTask(prev => {
      if (!prev || prev.id !== taskId) return prev;
      const agents = new Map(prev.agents);
      const existing = agents.get(agentId) || { id: agentId, type: 'belter' as const, status: 'pending' as const, progress: 0 };
      agents.set(agentId, { ...existing, ...updates });
      return { ...prev, agents };
    });
  }, []);

  const startResearch = useCallback(async (prompt: string, provider: string, model: string, agentCount: number) => {
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Submit task
    const res = await fetch(apiUrl('/api/beltalowda/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: prompt, provider, model, agents: agentCount }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Failed to start research' }));
      throw new Error(data.error);
    }

    const { taskId } = await res.json();

    const task: ResearchTask = {
      id: taskId,
      prompt,
      provider,
      model,
      agentCount,
      status: 'starting',
      agents: new Map(),
      artifacts: [],
      startedAt: Date.now(),
    };
    setActiveTask(task);

    // Connect SSE stream
    const es = new EventSource(apiUrl(`/api/beltalowda/stream/${taskId}`));
    eventSourceRef.current = es;

    es.addEventListener('decomposition', (e) => {
      const data = JSON.parse(e.data);
      setActiveTask(prev => prev ? { ...prev, status: 'running', decomposition: data.data?.questions || [] } : prev);
    });

    es.addEventListener('belter_start', (e) => {
      const data = JSON.parse(e.data);
      const d = data.data || data;
      updateAgent(taskId, d.agent_id, {
        type: 'belter',
        status: 'running',
        task: d.task,
        name: d.agent_name,
        description: d.description,
        index: d.index,
        progress: 0,
      });
    });

    es.addEventListener('belter_progress', (e) => {
      const data = JSON.parse(e.data);
      const d = data.data || data;
      updateAgent(taskId, d.agent_id, {
        progress: d.progress || 0,
        description: d.description,
      });
    });

    es.addEventListener('belter_complete', (e) => {
      const data = JSON.parse(e.data);
      const d = data.data || data;
      updateAgent(taskId, d.agent_id, { status: 'complete', progress: 100 });
    });

    es.addEventListener('drummer_start', (e) => {
      const data = JSON.parse(e.data);
      const d = data.data || data;
      setActiveTask(prev => prev ? { ...prev, status: 'synthesizing' } : prev);
      updateAgent(taskId, d.agent_id, {
        type: 'drummer',
        status: 'running',
        name: d.agent_name,
        description: 'Synthesizing belter outputs',
        index: d.index,
        progress: 0,
      });
    });

    es.addEventListener('drummer_progress', (e) => {
      const data = JSON.parse(e.data);
      const d = data.data || data;
      updateAgent(taskId, d.agent_id, {
        progress: d.progress || 50,
        description: d.description || d.task,
      });
    });

    es.addEventListener('drummer_complete', (e) => {
      const data = JSON.parse(e.data);
      const d = data.data || data;
      updateAgent(taskId, d.agent_id, { status: 'complete', progress: 100 });
    });

    es.addEventListener('camina_start', (e) => {
      const data = JSON.parse(e.data);
      const d = data.data || data;
      updateAgent(taskId, d.agent_id || 'camina_1', {
        type: 'camina',
        status: 'running',
        task: d.task,
        description: 'Executive synthesis',
        progress: 0,
      });
    });

    es.addEventListener('camina_progress', (e) => {
      const data = JSON.parse(e.data);
      const d = data.data || data;
      updateAgent(taskId, d.agent_id || 'camina_1', {
        progress: d.progress || 0,
        description: d.description,
      });
    });

    es.addEventListener('camina_stream', (e) => {
      const data = JSON.parse(e.data);
      setActiveTask(prev => {
        if (!prev) return prev;
        const content = (prev.caminaContent || '') + (data.content || '');
        return { ...prev, caminaContent: content };
      });
    });

    es.addEventListener('camina_complete', (e) => {
      const data = JSON.parse(e.data);
      const d = data.data || data;
      updateAgent(taskId, d.agent_id || 'camina_1', { status: 'complete', progress: 100 });
      if (d.full_content) {
        setActiveTask(prev => prev ? { ...prev, caminaContent: d.full_content } : prev);
      }
    });

    es.addEventListener('artifact_list', (e) => {
      const data = JSON.parse(e.data);
      setActiveTask(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          artifacts: (data.artifacts || []).map((a: Record<string, unknown>) => ({
            agentType: a.agent_type,
            agentId: a.agent_id,
            filename: a.filename,
            downloadPath: a.download_path,
          })),
        };
      });
    });

    es.addEventListener('task_complete', (e) => {
      const data = JSON.parse(e.data);
      setActiveTask(prev => {
        if (!prev) return prev;
        const completed = {
          ...prev,
          status: 'complete' as const,
          executionTime: data.execution_time,
          totalCost: data.total_cost,
          completedAt: Date.now(),
        };
        setTaskHistory(h => [completed, ...h].slice(0, 20));
        return completed;
      });
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('task_error', (e) => {
      const data = JSON.parse(e.data);
      setActiveTask(prev => prev ? { ...prev, status: 'error', error: data.error, completedAt: Date.now() } : prev);
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('task_cancelled', () => {
      setActiveTask(prev => prev ? { ...prev, status: 'cancelled', completedAt: Date.now() } : prev);
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('error', () => {
      // SSE connection error — may reconnect automatically
    });
  }, [updateAgent]);

  const cancelResearch = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setActiveTask(prev => prev ? { ...prev, status: 'cancelled', completedAt: Date.now() } : prev);
  }, []);

  return (
    <OrchestrationContext.Provider value={{ activeTask, taskHistory, startResearch, cancelResearch }}>
      {children}
    </OrchestrationContext.Provider>
  );
}

export function useOrchestration() {
  const ctx = useContext(OrchestrationContext);
  if (!ctx) throw new Error('useOrchestration must be used within OrchestrationProvider');
  return ctx;
}

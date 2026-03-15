// ============================================================
// Job Context — Async job tracking for image, video, tts, research
// Ported from imagine-studio JobManager with unified workspace adaptations
// ============================================================

import { createContext, useContext, useCallback, useRef, useState, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/api-base';

// ── Job Types ───────────────────────────────────────────────────────────────

export type JobType = 'image' | 'video' | 'tts' | 'research';
export type JobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface BaseJob {
  id: string;
  type: JobType;
  status: JobStatus;
  prompt: string;
  provider?: string;
  model?: string;
  startedAt: number;
  completedAt?: number;
  error?: string;
  cachedId?: number;
}

export interface ImageJob extends BaseJob {
  type: 'image';
  url?: string;
  revised_prompt?: string;
}

export interface VideoJob extends BaseJob {
  type: 'video';
  requestId: string;
  videoUrl?: string;
}

export interface TTSJob extends BaseJob {
  type: 'tts';
  audioUrl?: string;
  voice?: string;
}

export interface ResearchJob extends BaseJob {
  type: 'research';
  reportUrl?: string;
  agentCount?: number;
}

export type Job = ImageJob | VideoJob | TTSJob | ResearchJob;

// ── Context ─────────────────────────────────────────────────────────────────

interface JobContextType {
  jobs: Job[];
  addJob: (job: Job) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  clearJobs: (type?: JobType) => void;
  getJobsByType: (type: JobType) => Job[];
  getActiveCount: (type?: JobType) => number;
  startVideoPolling: (requestId: string, jobId: string, prompt: string, provider?: string) => void;
  stopVideoPolling: (requestId: string) => void;
  stopAllPolling: () => void;
}

const JobContext = createContext<JobContextType | null>(null);

export function useJobs() {
  const ctx = useContext(JobContext);
  if (!ctx) throw new Error('useJobs must be used within JobProvider');
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────

const JOBS_STORAGE_KEY = 'geepers-chat-jobs';

function loadPersistedJobs(): Job[] {
  try {
    const raw = localStorage.getItem(JOBS_STORAGE_KEY);
    if (!raw) return [];
    const jobs = JSON.parse(raw) as Job[];
    // Only restore non-terminal video jobs (they need polling resumed)
    return jobs.filter(j => j.type === 'video' && (j.status === 'pending' || j.status === 'processing'));
  } catch { return []; }
}

function persistJobs(jobs: Job[]) {
  try {
    // Only persist active video jobs (they need polling across refresh)
    const toSave = jobs.filter(j => j.type === 'video' && (j.status === 'pending' || j.status === 'processing'));
    if (toSave.length > 0) {
      localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(toSave));
    } else {
      localStorage.removeItem(JOBS_STORAGE_KEY);
    }
  } catch { /* storage full or unavailable */ }
}

export function JobProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(loadPersistedJobs);
  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const activePolls = useRef<Map<string, { jobId: string; prompt: string; provider?: string }>>(new Map());
  const hasRestoredPolling = useRef(false);

  // Persist active video jobs to localStorage on change
  useEffect(() => {
    persistJobs(jobs);
  }, [jobs]);

  // Visibility-aware polling — immediately poll all active video jobs when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activePolls.current.size > 0) {
        for (const [requestId, { jobId, prompt, provider }] of Array.from(activePolls.current.entries())) {
          const existing = pollTimers.current.get(requestId);
          if (existing) clearTimeout(existing);
          pollVideoStatus(requestId, jobId, prompt, provider);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []); // pollVideoStatus has stable [] deps — safe to omit

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollTimers.current.forEach(timer => clearTimeout(timer));
      pollTimers.current.clear();
      activePolls.current.clear();
    };
  }, []);

  const addJob = useCallback((job: Job) => {
    setJobs(prev => [job, ...prev]);
  }, []);

  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } as Job : j));
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  const clearJobs = useCallback((type?: JobType) => {
    if (type) {
      if (type === 'video') {
        setJobs(prev => {
          const videosToRemove = prev.filter(j => j.type === 'video') as VideoJob[];
          videosToRemove.forEach(v => {
            const timer = pollTimers.current.get(v.requestId);
            if (timer) { clearTimeout(timer); pollTimers.current.delete(v.requestId); }
            activePolls.current.delete(v.requestId);
          });
          return prev.filter(j => j.type !== type);
        });
      } else {
        setJobs(prev => prev.filter(j => j.type !== type));
      }
    } else {
      pollTimers.current.forEach(timer => clearTimeout(timer));
      pollTimers.current.clear();
      activePolls.current.clear();
      setJobs([]);
    }
  }, []);

  const getJobsByType = useCallback((type: JobType) => {
    return jobs.filter(j => j.type === type);
  }, [jobs]);

  const getActiveCount = useCallback((type?: JobType) => {
    const active = jobs.filter(j => j.status === 'pending' || j.status === 'processing');
    if (type) return active.filter(j => j.type === type).length;
    return active.length;
  }, [jobs]);

  // ── Video Polling ─────────────────────────────────────────────────────

  const pollVideoStatus = useCallback(async (requestId: string, jobId: string, prompt: string, provider?: string) => {
    try {
      const providerParam = provider ? `&provider=${encodeURIComponent(provider)}` : '';
      const response = await fetch(apiUrl(`/api/video/status?requestId=${encodeURIComponent(requestId)}${providerParam}`));
      const result = await response.json();

      if (!result) {
        scheduleNextPoll(requestId, jobId, prompt, 5000);
        return;
      }

      const status = result.status as string | undefined;

      if (status === 'processing' || status === 'pending') {
        const interval = document.visibilityState === 'hidden' ? 15000 : 5000;
        scheduleNextPoll(requestId, jobId, prompt, interval, provider);
      } else if (status === 'done') {
        const videoUrl = result.video?.url as string | undefined;
        setJobs(prev => prev.map(j =>
          j.id === jobId
            ? { ...j, status: 'done' as const, videoUrl, completedAt: Date.now() }
            : j
        ));
        pollTimers.current.delete(requestId);
        activePolls.current.delete(requestId);
        toast.success(`Video ready: "${prompt.slice(0, 40)}${prompt.length > 40 ? '...' : ''}"`);
      } else if (status === 'failed' || status === 'error' || status === 'expired') {
        const errorMsg = (result.error as string) || `Video ${status}`;
        setJobs(prev => prev.map(j =>
          j.id === jobId
            ? { ...j, status: 'error' as const, error: errorMsg, completedAt: Date.now() }
            : j
        ));
        pollTimers.current.delete(requestId);
        activePolls.current.delete(requestId);
        toast.error(`Video ${status}: "${prompt.slice(0, 40)}..."`);
      } else {
        const videoUrl = result.video?.url as string | undefined;
        if (videoUrl) {
          setJobs(prev => prev.map(j =>
            j.id === jobId
              ? { ...j, status: 'done' as const, videoUrl, completedAt: Date.now() }
              : j
          ));
          pollTimers.current.delete(requestId);
          activePolls.current.delete(requestId);
          toast.success(`Video ready: "${prompt.slice(0, 40)}${prompt.length > 40 ? '...' : ''}"`);
        } else {
          scheduleNextPoll(requestId, jobId, prompt, 5000, provider);
        }
      }
    } catch (err) {
      console.warn('[JobContext] Poll error for', requestId, err);
      const interval = document.visibilityState === 'hidden' ? 30000 : 10000;
      scheduleNextPoll(requestId, jobId, prompt, interval, provider);
    }
  }, []);

  const scheduleNextPoll = useCallback((requestId: string, jobId: string, prompt: string, intervalMs: number, provider?: string) => {
    const timer = setTimeout(() => pollVideoStatus(requestId, jobId, prompt, provider), intervalMs);
    pollTimers.current.set(requestId, timer);
  }, [pollVideoStatus]);

  const startVideoPolling = useCallback((requestId: string, jobId: string, prompt: string, provider?: string) => {
    activePolls.current.set(requestId, { jobId, prompt, provider });
    scheduleNextPoll(requestId, jobId, prompt, 5000, provider);
  }, [scheduleNextPoll]);

  const stopVideoPolling = useCallback((requestId: string) => {
    const timer = pollTimers.current.get(requestId);
    if (timer) {
      clearTimeout(timer);
      pollTimers.current.delete(requestId);
    }
    activePolls.current.delete(requestId);
  }, []);

  const stopAllPolling = useCallback(() => {
    pollTimers.current.forEach(timer => clearTimeout(timer));
    pollTimers.current.clear();
    activePolls.current.clear();
  }, []);

  // Restore polling for persisted video jobs after page refresh
  useEffect(() => {
    if (hasRestoredPolling.current) return;
    hasRestoredPolling.current = true;
    const activeVideoJobs = jobs.filter(
      (j): j is VideoJob => j.type === 'video' && (j.status === 'pending' || j.status === 'processing'),
    );
    for (const job of activeVideoJobs) {
      activePolls.current.set(job.requestId, { jobId: job.id, prompt: job.prompt, provider: job.provider });
      pollVideoStatus(job.requestId, job.id, job.prompt, job.provider);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <JobContext.Provider value={{
      jobs,
      addJob,
      updateJob,
      removeJob,
      clearJobs,
      getJobsByType,
      getActiveCount,
      startVideoPolling,
      stopVideoPolling,
      stopAllPolling,
    }}>
      {children}
    </JobContext.Provider>
  );
}

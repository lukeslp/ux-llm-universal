// ============================================================
// useManusPolling — Polls Manus task status with exponential backoff
// Stops on terminal status (completed/failed/cancelled)
// Resumes when taskId changes (switching back to a running task)
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { getManusTaskStatus } from '@/lib/manus-client';
import type { ManusTask, ManusTaskStatus } from '@/lib/manus-client';

const TERMINAL_STATUSES: ManusTaskStatus[] = ['completed', 'failed', 'cancelled'];

// Backoff schedule: 3s, 5s, 8s, 10s (cap)
function getBackoffMs(attempt: number): number {
  const schedule = [3000, 5000, 8000, 10000];
  return schedule[Math.min(attempt, schedule.length - 1)];
}

export function useManusPolling(
  taskId: string | null,
  onUpdate: (task: ManusTask) => void,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  const activeTaskIdRef = useRef<string | null>(null);

  const clearPoll = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const poll = useCallback(async (id: string) => {
    if (!mountedRef.current) return;

    try {
      const task = await getManusTaskStatus(id);

      if (!mountedRef.current || activeTaskIdRef.current !== id) return;

      onUpdate(task);

      if (TERMINAL_STATUSES.includes(task.status)) {
        // Stop polling — terminal state reached
        return;
      }

      // Schedule next poll with backoff
      const delay = getBackoffMs(attemptRef.current);
      attemptRef.current += 1;

      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current && activeTaskIdRef.current === id) {
          poll(id);
        }
      }, delay);
    } catch {
      if (!mountedRef.current || activeTaskIdRef.current !== id) return;

      // On error, retry with backoff (don't stop polling — could be transient)
      const delay = getBackoffMs(attemptRef.current);
      attemptRef.current = Math.min(attemptRef.current + 1, 3); // cap at 10s after errors

      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current && activeTaskIdRef.current === id) {
          poll(id);
        }
      }, delay);
    }
  }, [onUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    clearPoll();
    attemptRef.current = 0;
    activeTaskIdRef.current = taskId;

    if (!taskId) return;

    // Start polling immediately
    poll(taskId);

    return () => {
      clearPoll();
    };
  }, [taskId, poll, clearPoll]);
}

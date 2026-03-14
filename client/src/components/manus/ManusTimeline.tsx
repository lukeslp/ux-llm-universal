// ============================================================
// ManusTimeline — Vertical progress timeline for Manus tasks
// Novel centerpiece: animated nodes, elapsed time, violet/purple theme
// ============================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ManusTask, ManusStep } from '@/lib/types';
import { useManusPolling } from '@/hooks/useManusPolling';
import { useChat } from '@/contexts/ChatContext';

interface Props {
  task: ManusTask;
}

const DEFAULT_LIFECYCLE_STEPS: ManusStep[] = [
  { label: 'Task received', status: 'done', timestamp: 0 },
  { label: 'Planning', status: 'running', timestamp: 0 },
  { label: 'Executing', status: 'pending', timestamp: 0 },
  { label: 'Reviewing', status: 'pending', timestamp: 0 },
  { label: 'Finalizing', status: 'pending', timestamp: 0 },
];

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;
  return `0:${String(seconds).padStart(2, '0')}`;
}

function StepNode({ step, isLast }: { step: ManusStep; isLast: boolean }) {
  const isRunning = step.status === 'running';
  const isDone = step.status === 'done';
  const isPending = step.status === 'pending';

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-500 shrink-0',
            {
              'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30': isDone,
              'border-violet-400 bg-violet-50 dark:bg-violet-950/30': isRunning,
              'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900': isPending,
            },
          )}
        >
          {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          {isRunning && <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />}
          {isPending && <Circle className="w-3 h-3 text-gray-300 dark:text-gray-700" />}
        </div>
        {!isLast && (
          <div
            className={cn('w-0.5 mt-1 transition-all duration-700', {
              'bg-emerald-300 dark:bg-emerald-700 h-6': isDone,
              'bg-violet-200 dark:bg-violet-800 h-6': isRunning,
              'bg-gray-100 dark:bg-gray-800 h-6': isPending,
            })}
          />
        )}
      </div>
      <div className="pb-4 min-w-0">
        <p
          className={cn('text-sm font-medium', {
            'text-foreground': isDone || isRunning,
            'text-muted-foreground/50': isPending,
          })}
        >
          {step.label}
        </p>
        {step.detail && (
          <p className="text-xs text-muted-foreground/60 mt-0.5 truncate max-w-xs">{step.detail}</p>
        )}
      </div>
    </div>
  );
}

export default function ManusTimeline({ task }: Props) {
  const { dispatch } = useChat();
  const [elapsed, setElapsed] = useState(0);
  const isRunning = task.status === 'running' || task.status === 'pending';

  // Elapsed time counter
  useEffect(() => {
    if (!isRunning) return;
    const start = task.createdAt;
    const update = () => setElapsed(Date.now() - start);
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isRunning, task.createdAt]);

  // Poll task status
  useManusPolling(isRunning ? task.id : null, (updated) => {
    dispatch({ type: 'UPDATE_MANUS_TASK', payload: updated });
  });

  const steps = task.steps && task.steps.length > 0 ? task.steps : DEFAULT_LIFECYCLE_STEPS;

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 transition-all duration-500',
        isRunning
          ? 'border-violet-200 dark:border-violet-800/50 bg-violet-50/30 dark:bg-violet-950/10 shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_0_20px_rgba(139,92,246,0.08)]'
          : task.status === 'completed'
          ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/20 dark:bg-emerald-950/10'
          : task.status === 'failed'
          ? 'border-red-200 dark:border-red-800/50 bg-red-50/20 dark:bg-red-950/10'
          : 'border-border bg-card',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground line-clamp-2">{task.prompt}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-muted-foreground/60 font-mono">{task.model}</span>
            {isRunning && (
              <span className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium">
                <Clock className="w-3 h-3" />
                Running for {formatElapsed(elapsed)}
              </span>
            )}
            {task.status === 'completed' && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Complete
              </span>
            )}
            {task.status === 'failed' && (
              <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <XCircle className="w-3 h-3" />
                Failed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="pl-1">
        <AnimatePresence>
          {steps.map((step, i) => (
            <motion.div
              key={`${step.label}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <StepNode step={step} isLast={i === steps.length - 1} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Error message */}
      {task.error && (
        <div className="mt-3 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-800/50">
          <p className="text-xs text-red-700 dark:text-red-400">{task.error}</p>
        </div>
      )}

      {/* Ambient running animation */}
      {isRunning && (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-violet-400"
                style={{
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
          <span className="text-xs text-violet-500 dark:text-violet-400">Processing…</span>
        </div>
      )}
    </div>
  );
}

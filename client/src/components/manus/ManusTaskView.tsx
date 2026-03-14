// ============================================================
// ManusTaskView — Main container for Manus task mode
// Replaces chat area when provider === 'manus'
// Layout: task input (top) → active task timeline (middle) → task history (bottom)
// ============================================================

import { motion, AnimatePresence } from 'framer-motion';
import { ListTodo, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useChat } from '@/contexts/ChatContext';
import ManusTaskInput from './ManusTaskInput';
import ManusTimeline from './ManusTimeline';
import ManusResult from './ManusResult';
import ManusTaskHistory from './ManusTaskHistory';
import ManusStatusBadge from './ManusStatusBadge';
import { useState } from 'react';

export default function ManusTaskView() {
  const { state } = useChat();
  const { manusTasks, activeManusTaskId } = state;
  const [showHistory, setShowHistory] = useState(false);

  const activeTask = manusTasks.find(t => t.id === activeManusTaskId) || manusTasks[0] || null;
  const isRunning =
    activeTask?.status === 'running' || activeTask?.status === 'pending';
  const otherTasks = manusTasks.filter(t => t.id !== activeTask?.id);

  return (
    <div
      className={cn(
        'flex-1 flex flex-col min-h-0 relative transition-all duration-700',
        isRunning
          ? 'bg-gradient-to-b from-violet-50/20 dark:from-violet-950/10 to-transparent'
          : '',
      )}
    >
      {/* Ambient running border */}
      {isRunning && (
        <div className="absolute inset-0 pointer-events-none rounded-none">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-60 animate-pulse" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm shrink-0">
              <ListTodo className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Manus Tasks</h2>
              <p className="text-xs text-muted-foreground/60">Async AI agent — submit a project, get structured results</p>
            </div>
          </div>

          {/* Task input */}
          <ManusTaskInput isRunning={isRunning} />

          {/* Active task */}
          <AnimatePresence mode="wait">
            {activeTask && (
              <motion.div
                key={activeTask.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Active Task</h3>
                    <ManusStatusBadge status={activeTask.status} />
                  </div>
                </div>

                {/* Timeline for running/pending */}
                {(activeTask.status === 'running' || activeTask.status === 'pending') && (
                  <ManusTimeline task={activeTask} />
                )}

                {/* Result for completed */}
                {activeTask.status === 'completed' && (
                  <div className="space-y-4">
                    <ManusTimeline task={activeTask} />
                    <ManusResult task={activeTask} />
                  </div>
                )}

                {/* Error for failed */}
                {activeTask.status === 'failed' && (
                  <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-950/10 p-4">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Task Failed</p>
                    <p className="text-xs text-red-600/70 dark:text-red-400/70">
                      {activeTask.error || 'The task encountered an error.'}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Task history toggle */}
          {otherTasks.length > 0 && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(h => !h)}
                className="w-full justify-between h-9 text-sm text-muted-foreground hover:text-foreground"
              >
                <span>Task History ({otherTasks.length})</span>
                <ChevronDown
                  className={cn('w-4 h-4 transition-transform', showHistory && 'rotate-180')}
                />
              </Button>
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2">
                      <ManusTaskHistory compact />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

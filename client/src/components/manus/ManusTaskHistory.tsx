// ============================================================
// ManusTaskHistory — Task list for sidebar/main panel
// Status badge, prompt preview, timestamp, model
// ============================================================

import { Trash2, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ManusTask } from '@/lib/types';
import ManusStatusBadge from './ManusStatusBadge';
import { useChat } from '@/contexts/ChatContext';

interface Props {
  compact?: boolean;
  onSelect?: (id: string) => void;
}

function formatAge(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export default function ManusTaskHistory({ compact, onSelect }: Props) {
  const { state, dispatch } = useChat();
  const { manusTasks, activeManusTaskId } = state;

  const handleSelect = (id: string) => {
    dispatch({ type: 'SET_ACTIVE_MANUS_TASK', payload: id });
    onSelect?.(id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: 'DELETE_MANUS_TASK', payload: id });
  };

  if (manusTasks.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <ListTodo className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground/60">No tasks yet</p>
        <p className="text-xs text-muted-foreground/40 mt-1">
          Submit a task to get started
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-1 px-2">
        {manusTasks.map(task => (
          <div
            key={task.id}
            onClick={() => handleSelect(task.id)}
            className={cn(
              'group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors',
              task.id === activeManusTaskId
                ? 'bg-violet-50 dark:bg-violet-950/30 text-violet-900 dark:text-violet-100'
                : 'hover:bg-sidebar-accent/50',
            )}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{task.prompt}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ManusStatusBadge status={task.status} className="text-[10px] py-0 px-1.5" />
                <span className="text-[10px] text-muted-foreground/50">{formatAge(task.createdAt)}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-destructive/10 hover:text-destructive"
              onClick={e => handleDelete(e, task.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {manusTasks.map(task => (
          <div
            key={task.id}
            onClick={() => handleSelect(task.id)}
            className={cn(
              'group flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors',
              task.id === activeManusTaskId
                ? 'bg-violet-50 dark:bg-violet-950/30'
                : 'hover:bg-sidebar-accent/50',
            )}
          >
            <div className="flex-1 min-w-0">
              <p
                className={cn('text-sm font-medium truncate', {
                  'text-violet-900 dark:text-violet-100': task.id === activeManusTaskId,
                })}
              >
                {task.prompt.slice(0, 60)}{task.prompt.length > 60 ? '…' : ''}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <ManusStatusBadge status={task.status} />
                <span className="text-xs text-muted-foreground/50">{formatAge(task.createdAt)}</span>
                <span className="text-xs text-muted-foreground/40 font-mono truncate">{task.model}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-destructive/10 hover:text-destructive mt-0.5"
              onClick={e => handleDelete(e, task.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

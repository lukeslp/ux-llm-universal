// ============================================================
// ManusStatusBadge — Reusable status badge for Manus tasks
// Color-coded: pending=gray, running=amber+pulse, completed=green, failed=red, cancelled=slate
// ============================================================

import { cn } from '@/lib/utils';
import type { ManusTaskStatus } from '@/lib/types';

interface Props {
  status: ManusTaskStatus;
  className?: string;
}

const STATUS_CONFIG: Record<ManusTaskStatus, { label: string; className: string; pulse?: boolean }> = {
  pending: {
    label: 'Pending',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  },
  running: {
    label: 'Running',
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    pulse: true,
  },
  completed: {
    label: 'Completed',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 border-red-200 dark:border-red-800',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-500 border-slate-200 dark:border-slate-700',
  },
};

export default function ManusStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className,
      )}
    >
      {config.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
        </span>
      )}
      {!config.pulse && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', {
            'bg-gray-400': status === 'pending',
            'bg-emerald-500': status === 'completed',
            'bg-red-500': status === 'failed',
            'bg-slate-400': status === 'cancelled',
          })}
        />
      )}
      {config.label}
    </span>
  );
}

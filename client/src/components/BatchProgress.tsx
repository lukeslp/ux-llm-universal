// ============================================================
// Batch Progress — Progress bar for batch operations
// Ported from imagine-studio
// ============================================================

import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface BatchProgressProps {
  total: number;
  succeeded: number;
  failed: number;
  isRunning: boolean;
  label?: string;
}

export function BatchProgress({ total, succeeded, failed, isRunning, label }: BatchProgressProps) {
  const completed = succeeded + failed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border/50">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground/80 flex items-center gap-2">
          {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {label || 'Batch Generation'}
        </span>
        <span className="text-muted-foreground text-xs">
          {completed}/{total} ({percent}%)
        </span>
      </div>
      <Progress value={percent} className="h-2" />
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1 text-emerald-500">
          <CheckCircle className="h-3 w-3" />
          {succeeded} succeeded
        </span>
        {failed > 0 && (
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="h-3 w-3" />
            {failed} failed
          </span>
        )}
      </div>
    </div>
  );
}

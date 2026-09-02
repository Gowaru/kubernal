import { type JSX } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { K8sEvent } from '@kubernal/shared-types';

function formatRelativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

interface K8sEventFeedProps {
  events: K8sEvent[];
  maxItems?: number;
}

export function K8sEventFeed({ events, maxItems = 5 }: K8sEventFeedProps): JSX.Element {
  const sorted = [...events]
    .sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime())
    .slice(0, maxItems);

  if (sorted.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">Aucun événement récent</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((event) => {
        const isWarning = event.type === 'Warning';
        const Icon = isWarning ? AlertTriangle : CheckCircle2;

        return (
          <div
            key={event.id}
            className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/50 transition-colors"
          >
            <span
              className={cn(
                'flex items-center justify-center rounded-full h-5 w-5 shrink-0',
                isWarning
                  ? 'bg-k8s-pending/20 text-k8s-pending'
                  : 'bg-k8s-running/20 text-k8s-running',
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{event.reason}</p>
              <p className="text-[10px] text-muted-foreground truncate">{event.message}</p>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className="text-[10px] text-muted-foreground">
                {formatRelativeTime(event.lastTimestamp)}
              </span>
              {event.count > 1 && (
                <span className="text-[10px] text-muted-foreground font-mono">×{event.count}</span>
              )}
              <span className="text-[9px] text-muted-foreground">{event.source}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

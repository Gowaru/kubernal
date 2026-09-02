import { type JSX } from 'react';
import type { K8sPod, K8sPodPhase } from '@kubernal/shared-types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface PodTooltipProps {
  pod: K8sPod;
  children: React.ReactNode;
}

const STATUS_LABELS: Record<K8sPodPhase, string> = {
  Running: 'En cours',
  Pending: 'En attente',
  Failed: 'Échoué',
  CrashLoopBackOff: 'CrashLoopBackOff',
  Succeeded: 'Réussi',
  Terminating: 'Terminé',
  Unknown: 'Inconnu',
};

const STATUS_PILLS: Record<K8sPodPhase, string> = {
  Running: 'bg-k8s-running/20 text-k8s-running',
  Pending: 'bg-k8s-pending/20 text-k8s-pending',
  Failed: 'bg-k8s-failed/20 text-k8s-failed',
  CrashLoopBackOff: 'bg-k8s-failed/20 text-k8s-failed',
  Succeeded: 'bg-k8s-succeeded/20 text-k8s-succeeded',
  Terminating: 'bg-k8s-terminating/20 text-k8s-terminating',
  Unknown: 'bg-k8s-unknown/20 text-k8s-unknown',
};

function containerStateLabel(state: string): string {
  switch (state) {
    case 'running':
      return 'En cours';
    case 'waiting':
      return 'En attente';
    case 'terminated':
      return 'Terminé';
    default:
      return state;
  }
}

export function PodTooltip({ pod, children }: PodTooltipProps): JSX.Element {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="bg-popover border border-border rounded-lg shadow-xl p-3 max-w-xs z-50"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold truncate">{pod.name}</span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                STATUS_PILLS[pod.status] ?? STATUS_PILLS.Unknown,
              )}
            >
              {STATUS_LABELS[pod.status] ?? pod.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
            <span className="text-muted-foreground">Nœud</span>
            <span className="font-mono truncate">{pod.nodeName}</span>
            <span className="text-muted-foreground">Prêt</span>
            <span>{pod.ready}</span>
            <span className="text-muted-foreground">Redémarrages</span>
            <span className={cn(pod.restarts > 0 && 'text-k8s-failed')}>{pod.restarts}</span>
            <span className="text-muted-foreground">Âge</span>
            <span>{pod.age}</span>
            <span className="text-muted-foreground">IP</span>
            <span className="font-mono">{pod.ip ?? '—'}</span>
            <span className="text-muted-foreground">Namespace</span>
            <span className="font-mono truncate">{pod.namespace}</span>
          </div>

          {pod.containers.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <div className="text-[10px] font-medium text-muted-foreground mb-1">Conteneurs</div>
              <div className="space-y-1">
                {pod.containers.map((c) => (
                  <div key={c.name} className="text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono truncate">{c.name}</span>
                      <span className="text-muted-foreground truncate flex-shrink-0">
                        {c.image.split('/').pop()?.split(':')[1] ?? c.image.split('/').pop()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{containerStateLabel(c.state)}</span>
                      {c.restartCount > 0 && (
                        <span className="text-k8s-failed">{c.restartCount} restart</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

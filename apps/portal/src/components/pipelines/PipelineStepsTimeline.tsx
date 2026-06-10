import { type JSX } from 'react';
import { Circle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePipeline, usePipelineSteps } from '@/hooks/usePipelines';
import { formatRelativeTime } from '@/lib/utils';

interface PipelineStepsTimelineProps {
  pipelineId: string;
  deploymentId: string;
  onShowCves: (deploymentId: string) => void;
}

const STEP_STATUS_CONFIG = {
  pending: { icon: Circle, className: 'text-zinc-500' },
  running: { icon: Loader2, className: 'text-sky-400 animate-spin' },
  success: { icon: CheckCircle2, className: 'text-emerald-400' },
  failed: { icon: XCircle, className: 'text-red-400' },
  cancelled: { icon: XCircle, className: 'text-zinc-500' },
} as const;

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffMs = end - start;
  if (diffMs < 1000) return '<1s';
  if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`;
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.round((diffMs % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

export function PipelineStepsTimeline({ pipelineId, deploymentId, onShowCves }: PipelineStepsTimelineProps): JSX.Element {
  const { data: pipeline, isLoading: plLoading } = usePipeline(pipelineId);
  const { data: steps, isLoading: stepsLoading } = usePipelineSteps(pipelineId);

  if (plLoading || stepsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pipeline || !steps) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">Pipeline introuvable</p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span className="font-medium">{pipeline.name}</span>
        <span className={pipeline.status === 'running' ? 'text-sky-400' : ''}>
          {pipeline.status === 'running' ? 'En cours...' : pipeline.status}
        </span>
      </div>
      <div className="relative">
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
        <div className="space-y-4">
          {(steps as Array<{
            id: string;
            name: string;
            action: string;
            status: string;
            output?: { vulnCount?: number } | null;
            errorMessage?: string | null;
            startedAt: string | null;
            completedAt: string | null;
          }>).map((step) => {
            const statusKey = step.status as keyof typeof STEP_STATUS_CONFIG;
            const config = STEP_STATUS_CONFIG[statusKey] ?? STEP_STATUS_CONFIG.pending;
            const Icon = config.icon;
            const isRunning = step.status === 'running';
            const isScanAction = step.action === 'scan:image';
            const vulnCount = isScanAction ? (step.output?.vulnCount ?? 0) : 0;

            return (
              <div key={step.id} className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${isRunning ? 'border-sky-500/30' : step.status === 'success' ? 'border-emerald-500/30' : step.status === 'failed' ? 'border-red-500/30' : 'border-zinc-600/30'}`}
                  >
                    <Icon className={`h-3 w-3 ${config.className}`} />
                  </div>
                </div>
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{step.name}</span>
                    {step.action && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                        {step.action}
                      </Badge>
                    )}
                    {vulnCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onShowCves(deploymentId)}
                        className="inline-flex items-center rounded-md border border-orange-500/30 bg-orange-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-orange-400 hover:bg-orange-400/20 transition-colors"
                      >
                        {vulnCount} vuln.
                      </button>
                    )}
                    {step.startedAt && (
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {formatDuration(step.startedAt, step.completedAt)}
                      </span>
                    )}
                  </div>
                  {isRunning && (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-sky-500/50 animate-pulse" style={{ width: '60%' }} />
                    </div>
                  )}
                  {step.errorMessage && (
                    <p className="mt-1 text-xs text-red-400 line-clamp-2">{step.errorMessage}</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {step.startedAt ? formatRelativeTime(step.startedAt) : 'En attente'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, XCircle, Ban, Circle, Undo2 } from 'lucide-react';
import type { JSX } from 'react';
import type { DeploymentStatus, Pipeline, PipelineStage as PipelineStageType } from '@kubernal/shared-types';

export type StageStatus = 'success' | 'running' | 'failed' | 'pending' | 'skipped' | 'rolled_back' | 'cancelled';

interface Stage {
  label: string;
  status: StageStatus;
  duration?: string;
}

const STAGES: Record<DeploymentStatus, Stage[]> = {
  pending: [
    { label: 'Build', status: 'pending' },
    { label: 'Test', status: 'pending' },
    { label: 'Deploy', status: 'pending' },
    { label: 'Health', status: 'pending' },
  ],
  building: [
    { label: 'Build', status: 'running' },
    { label: 'Test', status: 'pending' },
    { label: 'Deploy', status: 'pending' },
    { label: 'Health', status: 'pending' },
  ],
  deploying: [
    { label: 'Build', status: 'success' },
    { label: 'Test', status: 'success' },
    { label: 'Deploy', status: 'running' },
    { label: 'Health', status: 'pending' },
  ],
  healthy: [
    { label: 'Build', status: 'success' },
    { label: 'Test', status: 'success' },
    { label: 'Deploy', status: 'success' },
    { label: 'Health', status: 'success' },
  ],
  failed: [
    { label: 'Build', status: 'success' },
    { label: 'Test', status: 'success' },
    { label: 'Deploy', status: 'failed' },
    { label: 'Health', status: 'skipped' },
  ],
  rolled_back: [
    { label: 'Build', status: 'success' },
    { label: 'Test', status: 'success' },
    { label: 'Deploy', status: 'rolled_back' },
    { label: 'Health', status: 'skipped' },
  ],
  cancelled: [
    { label: 'Build', status: 'cancelled' },
    { label: 'Test', status: 'skipped' },
    { label: 'Deploy', status: 'skipped' },
    { label: 'Health', status: 'skipped' },
  ],
};

const STAGE_DURATIONS: Record<string, string> = {
  Build: '12s',
  Test: '45s',
  Deploy: '1m 23s',
  Health: '8s',
};

const STAGE_CONFIG: Record<StageStatus, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-emerald-400' },
  running: { icon: Loader2, className: 'text-blue-400 animate-spin' },
  failed: { icon: XCircle, className: 'text-red-400' },
  pending: { icon: Circle, className: 'text-muted-foreground' },
  skipped: { icon: Ban, className: 'text-muted-foreground' },
  rolled_back: { icon: Undo2, className: 'text-orange-400' },
  cancelled: { icon: XCircle, className: 'text-muted-foreground' },
};

function formatDurationMs(ms: number | null): string | undefined {
  if (ms === null || ms === undefined) return undefined;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function mapPipelineStages(stages: PipelineStageType[]): Stage[] {
  return stages.map((s) => ({
    label: s.name,
    status: s.status as StageStatus,
    duration: formatDurationMs(s.durationMs),
  }));
}

interface PipelineTimelineProps {
  status: DeploymentStatus;
  pipeline?: Pipeline;
}

export function PipelineTimeline({ status, pipeline }: PipelineTimelineProps): JSX.Element {
  const stages = pipeline ? mapPipelineStages(pipeline.stages) : (STAGES[status] ?? STAGES.pending);

  return (
    <div className="space-y-0">
      {stages.map((stage, index) => {
        const config = STAGE_CONFIG[stage.status] ?? STAGE_CONFIG.pending;
        const Icon = config.icon;
        const duration = stage.duration ?? (!pipeline ? STAGE_DURATIONS[stage.label] : undefined);
        const isLast = index === stages.length - 1;

        return (
          <div key={stage.label} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-background', config.className)}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'h-full w-px',
                    stage.status === 'success'
                      ? 'bg-emerald-500/30'
                      : 'bg-border',
                  )}
                  style={{ minHeight: '2rem' }}
                />
              )}
            </div>
            <div className={cn('pb-6', isLast && 'pb-0')}>
              <p className="text-sm font-medium">{stage.label}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {stage.status === 'success' && 'Terminé'}
                  {stage.status === 'running' && 'En cours...'}
                  {stage.status === 'failed' && 'Échec'}
                  {stage.status === 'pending' && 'En attente'}
                  {stage.status === 'skipped' && 'Ignoré'}
                  {stage.status === 'rolled_back' && 'Rollback'}
                </span>
                {duration && (
                  <span className="font-mono">{duration}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

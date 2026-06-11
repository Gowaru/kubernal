import { useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  Boxes,
  Terminal,
  ScanLine,
  Rocket,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePipeline, usePipelineSteps } from '@/hooks/usePipelines';
import { usePipelineStep } from '@/hooks/usePipelineStep';
import { StepOutputView } from '@/components/pipelines/StepOutputView';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PipelineStepsTimelineProps {
  pipelineId: string;
  deploymentId: string;
  onShowCves: (deploymentId: string) => void;
}

interface StepDef {
  id: string;
  name: string;
  action: string;
  status: string;
  output?: { vulnCount?: number; criticalCount?: number; highCount?: number; image?: string; namespace?: string } | null;
  errorMessage?: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

const STATUS_ICON: Record<string, { Icon: LucideIcon; tone: string; ring: string }> = {
  pending: {
    Icon: Circle,
    tone: 'text-muted-foreground',
    ring: 'border-muted-foreground/40 bg-muted/40',
  },
  running: {
    Icon: Loader2,
    tone: 'text-status-info',
    ring: 'border-status-info/50 bg-status-info/15 shadow-[0_0_18px_-2px_hsl(var(--status-info)/0.45)]',
  },
  success: {
    Icon: CheckCircle2,
    tone: 'text-status-success',
    ring: 'border-status-success/50 bg-status-success/15',
  },
  failed: {
    Icon: XCircle,
    tone: 'text-status-error',
    ring: 'border-status-error/50 bg-status-error/15',
  },
  cancelled: {
    Icon: XCircle,
    tone: 'text-muted-foreground',
    ring: 'border-muted-foreground/40 bg-muted/30',
  },
};

const ACTION_ICON: Record<string, LucideIcon> = {
  'fetch:template': GitBranch,
  'scaffold:project': Boxes,
  'build:image': Boxes,
  'push:image': Rocket,
  'scan:image': ScanLine,
  'deploy:manifest': Rocket,
  'provision:infrastructure': Boxes,
  'run:script': Terminal,
};

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  if (diffMs < 1000) return '<1s';
  if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`;
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.round((diffMs % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function stepTotalDuration(steps: StepDef[]): string {
  const starts = steps
    .map((s) => (s.startedAt ? new Date(s.startedAt).getTime() : null))
    .filter((v): v is number => v !== null);
  const ends = steps
    .map((s) => (s.completedAt ? new Date(s.completedAt).getTime() : null))
    .filter((v): v is number => v !== null);
  if (starts.length === 0) return '—';
  const min = Math.min(...starts);
  const max = ends.length > 0 ? Math.max(...ends) : Date.now();
  return formatDuration(new Date(min).toISOString(), new Date(max).toISOString());
}

function statusPillClasses(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-status-success/15 text-status-success border-status-success/40';
    case 'failed':
      return 'bg-status-error/15 text-status-error border-status-error/40';
    case 'running':
      return 'bg-status-info/15 text-status-info border-status-info/40';
    case 'cancelled':
      return 'bg-muted text-muted-foreground border-muted-foreground/30';
    default:
      return 'bg-secondary text-muted-foreground border-border';
  }
}

function StepLogPanel({ pipelineId, step }: { pipelineId: string; step: StepDef }): JSX.Element {
  const { data: details, isLoading } = usePipelineStep(pipelineId, step.id);
  const params = (details?.params ?? step.output ?? {}) as Record<string, unknown>;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground border-t border-border bg-card/50">
        <Loader2 className="h-3 w-3 animate-spin" />
        Chargement des détails…
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card/50 px-4 py-3 space-y-3">
      {step.errorMessage && (
        <div className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-status-error uppercase tracking-wide">
            <AlertTriangle className="h-3 w-3" />
            Erreur
          </div>
          <p className="mt-1 text-xs text-status-error/90 font-mono whitespace-pre-wrap break-words">
            {step.errorMessage}
          </p>
        </div>
      )}

      {step.output && Object.keys(step.output).length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            <Terminal className="h-3 w-3" />
            Sortie
          </div>
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <StepOutputView action={step.action} output={step.output} />
          </motion.div>
        </div>
      )}

      {Object.keys(params).length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-[11px] font-semibold uppercase tracking-wide select-none">
            Paramètres d'entrée ({Object.keys(params).length})
          </summary>
          <pre className="mt-1 overflow-x-auto rounded-md bg-muted/40 border border-border px-3 py-2 text-[10px] font-mono leading-relaxed text-muted-foreground max-h-48">
            {JSON.stringify(params, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

interface StepTileProps {
  step: StepDef;
  isLast: boolean;
  isSelected: boolean;
  isSelectedForCve: boolean;
  onSelect: () => void;
  onShowCves: (deploymentId: string) => void;
}

function StepTile({
  step,
  isLast,
  isSelected,
  isSelectedForCve,
  onSelect,
  onShowCves,
}: StepTileProps): JSX.Element {
  const statusKey = (STATUS_ICON[step.status] ? step.status : 'pending') as keyof typeof STATUS_ICON;
  const { Icon, tone, ring } = STATUS_ICON[statusKey]!;
  const ActionIcon = ACTION_ICON[step.action];
  const duration = formatDuration(step.startedAt, step.completedAt);
  const isRunning = step.status === 'running';
  const isScan = step.action === 'scan:image';
  const vulnCount = isScan ? (step.output?.vulnCount ?? 0) : 0;
  const highCount = isScan ? (step.output?.highCount ?? 0) : 0;
  const criticalCount = isScan ? (step.output?.criticalCount ?? 0) : 0;

  return (
    <motion.div
      className="flex flex-col items-center min-w-0 flex-1"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'group relative flex flex-col items-center gap-1.5 w-full px-2 py-2 rounded-md transition-colors',
          'hover:bg-accent/10',
          isSelected && 'bg-accent/15',
        )}
        aria-expanded={isSelected}
      >
        <div className="relative">
          <motion.div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all',
              ring,
            )}
            animate={
              isRunning
                ? { scale: [0.95, 1.05, 0.95] }
                : { scale: 1 }
            }
            transition={
              isRunning
                ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.2 }
            }
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={step.status}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <Icon className={cn('h-4 w-4', tone, isRunning && 'animate-spin')} />
              </motion.div>
            </AnimatePresence>
          </motion.div>
          {ActionIcon && step.status === 'success' && (
            <ActionIcon className="h-3 w-3 absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-status-success text-status-success-foreground" />
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5 w-full px-1">
          <span
            className="text-xs font-medium text-foreground/90 truncate max-w-full"
            title={step.name}
          >
            {step.name}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {duration}
          </div>
        </div>
        {vulnCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShowCves(isSelectedForCve ? '' : step.id);
            }}
            className={cn(
              'mt-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
              criticalCount > 0
                ? 'border-status-error/40 bg-status-error/15 text-status-error hover:bg-status-error/25'
                : highCount > 0
                  ? 'border-status-warning/40 bg-status-warning/15 text-status-warning hover:bg-status-warning/25'
                  : 'border-muted-foreground/30 bg-muted text-muted-foreground',
            )}
            title="Voir les vulnérabilités"
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            {vulnCount} CVE{criticalCount > 0 ? ` (${criticalCount}C)` : highCount > 0 ? ` (${highCount}H)` : ''}
          </button>
        )}
      </button>
      {!isLast && (
        <motion.div
          className={cn(
            'h-0.5 w-full mt-1 -mb-1',
            step.status === 'success' ? 'bg-status-success/40' : 'bg-border',
          )}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: step.status === 'success' ? 1 : 0.3 }}
          style={{ originX: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      )}
    </motion.div>
  );
}

function PipelineSummary({ steps }: { steps: StepDef[] }): JSX.Element {
  const total = steps.length;
  const success = steps.filter((s) => s.status === 'success').length;
  const failed = steps.filter((s) => s.status === 'failed').length;
  const running = steps.filter((s) => s.status === 'running').length;
  const pending = steps.filter((s) => s.status === 'pending').length;
  const scanStep = steps.find((s) => s.action === 'scan:image' && s.output);
  const deployStep = steps.find((s) => s.action === 'deploy:manifest' && s.output);
  const buildStep = steps.find((s) => s.action === 'build:image' && s.output);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      <div className="rounded-md border border-border bg-card/50 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Étapes</div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="text-lg font-semibold text-foreground">{success}</span>
          <span className="text-xs text-muted-foreground">/ {total}</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px]">
          {failed > 0 && <span className="text-status-error">{failed} échec{failed > 1 ? 's' : ''}</span>}
          {running > 0 && <span className="text-status-info">{running} en cours</span>}
          {pending > 0 && <span className="text-muted-foreground">{pending} en attente</span>}
          {failed === 0 && running === 0 && pending === 0 && (
            <span className="text-status-success">Tout OK</span>
          )}
        </div>
      </div>
      {buildStep && buildStep.output && (
        <div className="rounded-md border border-border bg-card/50 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Image</div>
          <div className="mt-0.5 text-xs font-mono text-foreground/90 truncate" title={String(buildStep.output.image ?? '')}>
            {String(buildStep.output.image ?? '—')}
          </div>
        </div>
      )}
      {scanStep && scanStep.output && (
        <div className="rounded-md border border-border bg-card/50 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Scan</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span
              className={cn(
                'text-lg font-semibold',
                Number(scanStep.output.criticalCount ?? 0) > 0
                  ? 'text-status-error'
                  : Number(scanStep.output.highCount ?? 0) > 0
                    ? 'text-status-warning'
                    : 'text-status-success',
              )}
            >
              {String(scanStep.output.vulnCount ?? 0)}
            </span>
            <span className="text-xs text-muted-foreground">CVE</span>
          </div>
        </div>
      )}
      {deployStep && deployStep.output && (
        <div className="rounded-md border border-border bg-card/50 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Cible</div>
          <div className="mt-0.5 text-xs font-mono text-foreground/90 truncate" title={String(deployStep.output.namespace ?? '')}>
            {String(deployStep.output.namespace ?? '—')}
          </div>
        </div>
      )}
    </div>
  );
}

export function PipelineStepsTimeline({
  pipelineId,
  deploymentId,
  onShowCves,
}: PipelineStepsTimelineProps): JSX.Element {
  const { data: pipeline, isLoading: plLoading } = usePipeline(pipelineId);
  const { data: steps, isLoading: stepsLoading } = usePipelineSteps(pipelineId);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [cveStepId, setCveStepId] = useState<string | null>(null);

  if (plLoading || stepsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pipeline || !steps) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">Pipeline introuvable</p>
    );
  }

  const stepList = steps as StepDef[];
  const selectedStep = stepList.find((s) => s.id === selectedStepId) ?? null;
  const totalDuration = stepTotalDuration(stepList);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              statusPillClasses(pipeline.status),
            )}
          >
            {pipeline.status === 'running' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
            {pipeline.status}
          </span>
          <span className="text-sm font-mono text-muted-foreground truncate" title={pipeline.name}>
            {pipeline.name}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{totalDuration}</span>
          </div>
        </div>
      </div>

      <PipelineSummary steps={stepList} />

      <div className="rounded-md border border-border bg-card/30 p-3">
        <div className="flex items-stretch gap-0">
          {stepList.map((step, index) => (
            <StepTile
              key={step.id}
              step={step}
              isLast={index === stepList.length - 1}
              isSelected={selectedStepId === step.id}
              isSelectedForCve={cveStepId === step.id}
              onSelect={() => setSelectedStepId(selectedStepId === step.id ? null : step.id)}
              onShowCves={() => {
                setCveStepId(step.id);
                onShowCves(deploymentId);
              }}
            />
          ))}
        </div>

        {selectedStep && (
          <div className="mt-2 rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setSelectedStepId(null)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent/10 transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{selectedStep.name}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {selectedStep.action}
              </Badge>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {selectedStep.startedAt ? formatRelativeTime(selectedStep.startedAt) : 'En attente'}
              </span>
            </button>
            <StepLogPanel pipelineId={pipelineId} step={selectedStep} />
          </div>
        )}

        {!selectedStep && (
          <p className="mt-3 text-[11px] text-muted-foreground text-center">
            <ChevronRight className="inline h-3 w-3 -mt-0.5" /> Cliquez sur une étape pour voir ses détails
          </p>
        )}
      </div>
    </div>
  );
}

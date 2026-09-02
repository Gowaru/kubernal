import { useMemo, type JSX } from 'react';
import { motion } from 'framer-motion';
import { Cpu, MemoryStick, type LucideIcon } from 'lucide-react';
import type { K8sContainerResources } from '@kubernal/shared-types';
import { cn } from '@/lib/utils';

interface ResourceGaugeProps {
  resources: K8sContainerResources[];
}

function parseCpu(v: string | null): number | null {
  if (!v) return null;
  const m = v.match(/^(\d+)m$/);
  return m ? parseInt(m[1], 10) : null;
}

function parseMemory(v: string | null): number | null {
  if (!v) return null;
  const gi = v.match(/^(\d+(?:\.\d+)?)Gi$/);
  if (gi) return parseFloat(gi[1]) * 1024;
  const mi = v.match(/^(\d+)Mi$/);
  return mi ? parseInt(mi[1], 10) : null;
}

function usageTone(pct: number): 'success' | 'warning' | 'error' {
  if (pct > 80) return 'error';
  if (pct > 60) return 'warning';
  return 'success';
}

const TONE_BG: Record<'success' | 'warning' | 'error', string> = {
  success: 'bg-k8s-running/15 text-k8s-running',
  warning: 'bg-k8s-pending/15 text-k8s-pending',
  error: 'bg-k8s-failed/15 text-k8s-failed',
};

const TONE_STROKE: Record<'success' | 'warning' | 'error', string> = {
  success: 'stroke-k8s-running',
  warning: 'stroke-k8s-pending',
  error: 'stroke-k8s-failed',
};

const CIRCUMFERENCE = 2 * Math.PI * 38;

interface GaugeRingProps {
  icon: LucideIcon;
  label: string;
  percentage: number;
  request: string | null;
  limit: string | null;
  usage: string | null;
}

function GaugeRing({
  icon: Icon,
  label,
  percentage,
  request,
  limit,
  usage,
}: GaugeRingProps): JSX.Element {
  const offset = CIRCUMFERENCE * (1 - percentage / 100);
  const tone = usageTone(percentage);

  return (
    <div className="relative flex flex-col items-center gap-1.5 p-2 rounded-md border border-border bg-card/30 min-w-[110px]">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', TONE_BG[tone].split(' ')[1])} />
        <span className="text-xs font-medium text-foreground/80">{label}</span>
      </div>
      <div className="relative">
        <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
          <circle
            cx="40"
            cy="40"
            r="33"
            fill="none"
            strokeWidth="3"
            className="stroke-muted-foreground/20"
          />
          <motion.circle
            cx="40"
            cy="40"
            r="38"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={cn(TONE_STROKE[tone], percentage === 0 && 'opacity-0')}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-mono text-lg font-semibold', TONE_BG[tone].split(' ')[1])}>
            {percentage > 0 ? `${Math.round(percentage)}%` : '—'}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center text-[10px] font-mono text-muted-foreground w-full">
        <div className="flex justify-between w-full px-1">
          <span>Req</span>
          <span className="text-foreground/80">{request ?? '—'}</span>
        </div>
        <div className="flex justify-between w-full px-1">
          <span>Lim</span>
          <span className="text-foreground/80">{limit ?? '—'}</span>
        </div>
        <div className="flex justify-between w-full px-1">
          <span>Use</span>
          <span className={cn(percentage > 0 && TONE_BG[tone].split(' ')[1])}>{usage ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}

export function ResourceGauge({ resources }: ResourceGaugeProps): JSX.Element | null {
  const main =
    resources.find(
      (r) => !r.containerName.includes('istio') && !r.containerName.includes('proxy'),
    ) ?? resources[0];

  const cpuPct = useMemo(() => {
    if (!main) return 0;
    const used = parseCpu(main.cpuUsage);
    const lim = parseCpu(main.cpuLimit);
    if (used === null || lim === null || lim === 0) return 0;
    return Math.min((used / lim) * 100, 100);
  }, [main]);

  const memPct = useMemo(() => {
    if (!main) return 0;
    const used = parseMemory(main.memoryUsage);
    const lim = parseMemory(main.memoryLimit);
    if (used === null || lim === null || lim === 0) return 0;
    return Math.min((used / lim) * 100, 100);
  }, [main]);

  if (!main) return null;

  return (
    <div className="flex items-stretch gap-2 flex-wrap">
      <GaugeRing
        icon={Cpu}
        label="CPU"
        percentage={cpuPct}
        request={main.cpuRequest}
        limit={main.cpuLimit}
        usage={main.cpuUsage}
      />
      <GaugeRing
        icon={MemoryStick}
        label="Mémoire"
        percentage={memPct}
        request={main.memoryRequest}
        limit={main.memoryLimit}
        usage={main.memoryUsage}
      />
    </div>
  );
}

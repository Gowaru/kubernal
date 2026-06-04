import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { K8sContainerResources } from '@kubernal/shared-types';
import { cn } from '@/lib/utils';

interface ResourceGaugeProps {
  resources: K8sContainerResources[];
}

function parseCpu(v: string | null): number | null {
  if (!v) return null;
  const m = v.match(/^(\d+)m$/);
  return m ? parseInt(m[1]) : null;
}

function parseMemory(v: string | null): number | null {
  if (!v) return null;
  const gi = v.match(/^(\d+(?:\.\d+)?)Gi$/);
  if (gi) return parseFloat(gi[1]) * 1024;
  const mi = v.match(/^(\d+)Mi$/);
  return mi ? parseInt(mi[1]) : null;
}

function usageColor(pct: number): string {
  if (pct > 80) return 'stroke-k8s-failed';
  if (pct > 60) return 'stroke-k8s-pending';
  return 'stroke-k8s-running';
}

function usageTextColor(pct: number): string {
  if (pct > 80) return 'text-k8s-failed';
  if (pct > 60) return 'text-k8s-pending';
  return 'text-k8s-running';
}

const CIRCUMFERENCE = 2 * Math.PI * 38;

interface GaugeRingProps {
  percentage: number;
  label: string;
  request: string | null;
  limit: string | null;
  usage: string | null;
}

function GaugeRing({ percentage, label, request, limit, usage }: GaugeRingProps) {
  const offset = CIRCUMFERENCE * (1 - percentage / 100);
  const colorClass = usageColor(percentage);

  return (
    <div className="relative flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle
          cx="40"
          cy="40"
          r="28"
          fill="none"
          strokeWidth="3"
          className="stroke-muted-foreground/30"
        />
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
          className={cn(colorClass, percentage === 0 && 'opacity-0')}
        />
      </svg>
      <div className="absolute flex items-center justify-center w-[80px] h-[80px]">
        <span className="font-mono text-lg font-semibold">
          {percentage > 0 ? `${Math.round(percentage)}%` : '—'}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-col items-center text-[10px] font-mono text-muted-foreground">
        <span>Req: {request ?? '—'}</span>
        <span>Lim: {limit ?? '—'}</span>
        <span className={cn(percentage > 0 && usageTextColor(percentage))}>
          Use: {usage ?? '—'}
        </span>
      </div>
    </div>
  );
}

export function ResourceGauge({ resources }: ResourceGaugeProps) {
  const main = resources.find((r) => !r.containerName.includes('istio') && !r.containerName.includes('proxy')) ?? resources[0];

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
    <div className="flex items-center gap-6">
      <GaugeRing
        percentage={cpuPct}
        label="CPU"
        request={main.cpuRequest}
        limit={main.cpuLimit}
        usage={main.cpuUsage}
      />
      <GaugeRing
        percentage={memPct}
        label="Mémoire"
        request={main.memoryRequest}
        limit={main.memoryLimit}
        usage={main.memoryUsage}
      />
    </div>
  );
}

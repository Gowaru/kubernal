import { type JSX } from 'react';
import { motion } from 'framer-motion';
import type { K8sPod, K8sPodPhase } from '@kubernal/shared-types';
import { cn } from '@/lib/utils';

interface PodGridProps {
  pods: K8sPod[];
  selectedPodId?: string;
  onPodSelect: (pod: K8sPod) => void;
}

type PodCellStyle = {
  bg: string;
  border: string;
  hoverBorder: string;
  glow?: string;
  animate?: string;
  dotAnimate?: string;
};

const STATUS_STYLES: Record<K8sPodPhase, PodCellStyle> = {
  Running: {
    bg: 'bg-k8s-running/15',
    border: 'border-k8s-running/30',
    hoverBorder: 'hover:border-k8s-running/60',
    glow: 'glow-running',
  },
  Pending: {
    bg: 'bg-k8s-pending/15',
    border: 'border-k8s-pending/30',
    hoverBorder: 'hover:border-k8s-pending/60',
    animate: 'animate-pulse-glow',
    dotAnimate: 'animate-pulse-glow',
  },
  Failed: {
    bg: 'bg-k8s-failed/15',
    border: 'border-k8s-failed/30',
    hoverBorder: 'hover:border-k8s-failed/60',
    glow: 'glow-failed',
    dotAnimate: 'animate-blink-alert',
  },
  CrashLoopBackOff: {
    bg: 'bg-k8s-failed/15',
    border: 'border-k8s-failed/30',
    hoverBorder: 'hover:border-k8s-failed/60',
    glow: 'glow-failed',
    dotAnimate: 'animate-blink-alert',
  },
  Succeeded: {
    bg: 'bg-k8s-succeeded/15',
    border: 'border-k8s-succeeded/30',
    hoverBorder: 'hover:border-k8s-succeeded/60',
  },
  Unknown: {
    bg: 'bg-k8s-unknown/15',
    border: 'border-k8s-unknown/30',
    hoverBorder: 'hover:border-k8s-unknown/60',
  },
};

const DOT_COLORS: Record<K8sPodPhase, string> = {
  Running: 'bg-k8s-running',
  Pending: 'bg-k8s-pending',
  Failed: 'bg-k8s-failed',
  CrashLoopBackOff: 'bg-k8s-failed',
  Succeeded: 'bg-k8s-succeeded',
  Unknown: 'bg-k8s-unknown',
};

function getPodHashSuffix(name: string): string {
  const parts = name.split('-');
  return parts[parts.length - 1] || name.slice(0, 8);
}

function formatTooltip(pod: K8sPod): string {
  return [
    pod.name,
    `Statut: ${pod.status}`,
    `Noeud: ${pod.nodeName}`,
    `Redémarrages: ${pod.restarts}`,
    `Âge: ${pod.age}`,
  ].join('\n');
}

export function PodGrid({ pods, selectedPodId, onPodSelect }: PodGridProps): JSX.Element {
  const counts = pods.reduce<Record<K8sPodPhase, number>>(
    (acc, pod) => {
      acc[pod.status] = (acc[pod.status] ?? 0) + 1;
      return acc;
    },
    { Running: 0, Pending: 0, Failed: 0, CrashLoopBackOff: 0, Succeeded: 0, Unknown: 0 },
  );

  return (
    <div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
        {(['Running', 'Pending', 'Failed'] as K8sPodPhase[]).map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={cn('inline-block h-2 w-2 rounded-full', DOT_COLORS[status])} />
            {status}: {counts[status]}
          </span>
        ))}
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}
      >
        {pods.map((pod, index) => {
          const style = STATUS_STYLES[pod.status] ?? STATUS_STYLES.Unknown;
          const isSelected = selectedPodId === pod.id;

          return (
            <motion.div
              key={pod.id}
              layoutId={pod.id}
              title={formatTooltip(pod)}
              onClick={() => onPodSelect(pod)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.03 }}
              className={cn(
                'relative aspect-square rounded-xl cursor-pointer border-2 transition-all duration-200',
                style.bg,
                style.border,
                style.hoverBorder,
                style.glow,
                style.animate,
                isSelected && 'ring-2 ring-k8s-running ring-offset-2 ring-offset-background scale-105',
              )}
            >
              <span
                className={cn(
                  'absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full',
                  DOT_COLORS[pod.status],
                  style.dotAnimate,
                )}
              />
              <div className="flex flex-col items-center justify-center h-full gap-1 px-1">
                <span className="font-mono text-[10px] text-center truncate w-full">
                  {getPodHashSuffix(pod.name)}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {pod.ready}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

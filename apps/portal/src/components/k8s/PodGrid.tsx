import { type JSX } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Clock,
  XCircle,
  RotateCw,
  CheckCheck,
  X,
  HelpCircle,
  Container,
  type LucideIcon,
} from 'lucide-react';
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
  dotColor: string;
  icon: LucideIcon;
  iconColor: string;
  label: string;
};

const ALL_PHASES: K8sPodPhase[] = [
  'Running',
  'Pending',
  'Succeeded',
  'CrashLoopBackOff',
  'Failed',
  'Terminating',
  'Unknown',
];

const STATUS_STYLES: Record<K8sPodPhase, PodCellStyle> = {
  Running: {
    bg: 'bg-k8s-running/15',
    border: 'border-k8s-running/30',
    hoverBorder: 'hover:border-k8s-running/60',
    glow: 'glow-running',
    dotColor: 'bg-k8s-running',
    icon: Play,
    iconColor: 'text-k8s-running',
    label: 'En cours',
  },
  Pending: {
    bg: 'bg-k8s-pending/15',
    border: 'border-k8s-pending/30',
    hoverBorder: 'hover:border-k8s-pending/60',
    animate: 'animate-pulse-glow',
    dotAnimate: 'animate-pulse-glow',
    dotColor: 'bg-k8s-pending',
    icon: Clock,
    iconColor: 'text-k8s-pending',
    label: 'En attente',
  },
  Failed: {
    bg: 'bg-k8s-failed/15',
    border: 'border-k8s-failed/30',
    hoverBorder: 'hover:border-k8s-failed/60',
    glow: 'glow-failed',
    dotAnimate: 'animate-blink-alert',
    dotColor: 'bg-k8s-failed',
    icon: XCircle,
    iconColor: 'text-k8s-failed',
    label: 'Échoué',
  },
  CrashLoopBackOff: {
    bg: 'bg-k8s-failed/15',
    border: 'border-k8s-failed/30',
    hoverBorder: 'hover:border-k8s-failed/60',
    glow: 'glow-crashloop',
    dotAnimate: 'animate-blink-alert',
    dotColor: 'bg-k8s-failed',
    icon: RotateCw,
    iconColor: 'text-k8s-failed',
    label: 'CrashLoop',
  },
  Succeeded: {
    bg: 'bg-k8s-succeeded/15',
    border: 'border-k8s-succeeded/30',
    hoverBorder: 'hover:border-k8s-succeeded/60',
    dotColor: 'bg-k8s-succeeded',
    icon: CheckCheck,
    iconColor: 'text-k8s-succeeded',
    label: 'Réussi',
  },
  Terminating: {
    bg: 'bg-k8s-terminating/15',
    border: 'border-k8s-terminating/30',
    hoverBorder: 'hover:border-k8s-terminating/60',
    dotAnimate: 'animate-pulse-glow',
    dotColor: 'bg-k8s-terminating',
    icon: X,
    iconColor: 'text-k8s-terminating',
    label: 'Terminé',
  },
  Unknown: {
    bg: 'bg-k8s-unknown/15',
    border: 'border-k8s-unknown/30',
    hoverBorder: 'hover:border-k8s-unknown/60',
    dotColor: 'bg-k8s-unknown',
    icon: HelpCircle,
    iconColor: 'text-k8s-unknown',
    label: 'Inconnu',
  },
};

function getPodHashSuffix(name: string): string {
  const parts = name.split('-');
  return parts[parts.length - 1] || name.slice(0, 8);
}

function containerSummary(pod: K8sPod): string {
  const total = pod.containers.length;
  const ready = pod.containers.filter((c) => c.ready).length;
  const waiting = pod.containers.filter((c) => c.state === 'waiting').length;
  const terminated = pod.containers.filter((c) => c.state === 'terminated').length;
  const parts: string[] = [`${ready}/${total} ready`];
  if (waiting > 0) parts.push(`${waiting} waiting`);
  if (terminated > 0) parts.push(`${terminated} terminated`);
  return parts.join(' · ');
}

export function PodGrid({ pods, selectedPodId, onPodSelect }: PodGridProps): JSX.Element {
  const counts = pods.reduce<Record<K8sPodPhase, number>>(
    (acc, pod) => {
      acc[pod.status] = (acc[pod.status] ?? 0) + 1;
      return acc;
    },
    {
      Running: 0,
      Pending: 0,
      Succeeded: 0,
      Failed: 0,
      CrashLoopBackOff: 0,
      Terminating: 0,
      Unknown: 0,
    },
  );

  const activePhases = ALL_PHASES.filter((p) => counts[p] > 0);
  const totalRestarts = pods.reduce((sum, p) => sum + p.restarts, 0);
  const problemPods = counts.Failed + counts.CrashLoopBackOff + counts.Pending;

  return (
    <div>
      <div className="flex items-center gap-2 text-xs flex-wrap mb-3">
        {activePhases.map((status) => {
          const style = STATUS_STYLES[status];
          const Icon = style.icon;
          return (
            <div
              key={status}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1"
            >
              <Icon className={cn('h-3 w-3', style.iconColor, style.dotAnimate)} />
              <span className="text-foreground/80">{style.label}</span>
              <span className={cn('font-mono font-semibold', style.iconColor)}>
                {counts[status]}
              </span>
            </div>
          );
        })}
        {totalRestarts > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-status-warning/30 bg-status-warning/10 px-2.5 py-1">
            <RotateCw className="h-3 w-3 text-status-warning" />
            <span className="text-status-warning">
              {totalRestarts} restart{totalRestarts > 1 ? 's' : ''}
            </span>
          </div>
        )}
        {problemPods > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-status-error/30 bg-status-error/10 px-2.5 py-1 ml-auto">
            <XCircle className="h-3 w-3 text-status-error animate-blink-alert" />
            <span className="text-status-error font-medium">
              {problemPods} pod{problemPods > 1 ? 's' : ''} à problème{problemPods > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}
      >
        {pods.map((pod, index) => {
          const style = STATUS_STYLES[pod.status] ?? STATUS_STYLES.Unknown;
          const isSelected = selectedPodId === pod.id;
          const Icon = style.icon;
          const summary = containerSummary(pod);
          const tooltipText = [
            pod.name,
            `Statut: ${style.label}`,
            `Noeud: ${pod.nodeName}`,
            `Redémarrages: ${pod.restarts}`,
            `Âge: ${pod.age}`,
            summary,
          ].join('\n');

          return (
            <motion.div
              key={pod.id}
              layoutId={pod.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.03 }}
              className={cn(
                'relative aspect-square rounded-xl cursor-pointer border-2 transition-colors duration-200',
                'group',
                style.bg,
                style.border,
                style.hoverBorder,
                style.glow,
                style.animate,
                isSelected &&
                  'ring-2 ring-k8s-running ring-offset-2 ring-offset-background scale-105',
              )}
              onClick={() => onPodSelect(pod)}
              title={tooltipText}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center p-1.5 gap-1">
                <div className="flex items-center gap-1">
                  <Icon className={cn('h-3 w-3', style.iconColor, style.dotAnimate)} />
                  <span
                    className={cn(
                      'inline-block h-1.5 w-1.5 rounded-full',
                      style.dotColor,
                      style.dotAnimate,
                    )}
                  />
                </div>
                <Container className={cn('h-5 w-5', style.iconColor, 'opacity-50')} />
                <span className="font-mono text-[10px] text-center truncate w-full">
                  {getPodHashSuffix(pod.name)}
                </span>
                <span className="text-[9px] text-muted-foreground text-center truncate w-full">
                  {pod.ready}
                </span>
              </div>
              {pod.restarts > 0 && (
                <span className="absolute top-1 right-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-status-warning/90 text-[9px] font-bold text-background">
                  {pod.restarts}
                </span>
              )}
              {pod.status === 'CrashLoopBackOff' && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-status-error rounded-b-xl animate-pulse" />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

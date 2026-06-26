import { type JSX } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Pause, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArgoSyncStatus, ArgoHealthStatus } from '@kubernal/shared-types';
import type { LucideIcon } from 'lucide-react';

const syncLabels: Record<ArgoSyncStatus, string> = {
  Synced: 'Synchronisé',
  OutOfSync: 'Désynchronisé',
  Unknown: 'Inconnu',
};

const healthLabels: Record<ArgoHealthStatus, string> = {
  Healthy: 'Sain',
  Progressing: 'En cours',
  Degraded: 'Dégradé',
  Suspended: 'Suspendu',
  Unknown: 'Inconnu',
};

interface BadgeStyle {
  className: string;
  icon: LucideIcon;
  animate?: string;
}

function getBadgeStyle(sync: ArgoSyncStatus, health: ArgoHealthStatus): BadgeStyle {
  if (health === 'Degraded') {
    return {
      className: 'bg-k8s-failed/10 text-k8s-failed border-k8s-failed/20 glow-failed',
      icon: XCircle,
    };
  }
  if (sync === 'OutOfSync') {
    return {
      className: 'bg-k8s-pending/10 text-k8s-pending border-k8s-pending/20 glow-pending',
      icon: AlertTriangle,
      animate: 'animate-pulse-glow',
    };
  }
  if (health === 'Progressing') {
    return {
      className: 'bg-k8s-succeeded/10 text-k8s-succeeded border-k8s-succeeded/20',
      icon: Loader2,
      animate: 'animate-spin',
    };
  }
  if (health === 'Suspended') {
    return {
      className: 'bg-k8s-terminating/10 text-k8s-terminating border-k8s-terminating/20',
      icon: Pause,
    };
  }
  if (sync === 'Synced' && health === 'Healthy') {
    return {
      className: 'bg-k8s-running/10 text-k8s-running border-k8s-running/20 glow-running',
      icon: CheckCircle2,
    };
  }
  return {
    className: 'bg-k8s-unknown/10 text-k8s-unknown border-k8s-unknown/20',
    icon: HelpCircle,
  };
}

interface ArgoSyncBadgeProps {
  sync: ArgoSyncStatus;
  health: ArgoHealthStatus;
}

export function ArgoSyncBadge({ sync, health }: ArgoSyncBadgeProps): JSX.Element {
  const style = getBadgeStyle(sync, health);
  const Icon = style.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border',
        style.className,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', style.animate)} />
      {syncLabels[sync]} · {healthLabels[health]}
    </span>
  );
}

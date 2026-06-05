import {
  Ban,
  CheckCircle2,
  Clock,
  Hammer,
  Loader2,
  Undo2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ApplicationStatus, DeploymentStatus } from '@kubernal/shared-types';

export interface DeploymentStatusVisual {
  label: string;
  className: string;
  icon: LucideIcon;
}

export interface ApplicationStatusVisual {
  label: string;
  className: string;
  dot: string;
}

export const DEPLOYMENT_STATUS_CONFIG: Record<DeploymentStatus, DeploymentStatusVisual> = {
  pending: {
    label: 'En attente',
    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    icon: Clock,
  },
  building: {
    label: 'En construction',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: Hammer,
  },
  deploying: {
    label: 'Déploiement',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    icon: Loader2,
  },
  healthy: {
    label: 'Succès',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Échec',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: XCircle,
  },
  rolled_back: {
    label: 'Rollback',
    className: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    icon: Undo2,
  },
  cancelled: {
    label: 'Annulé',
    className: 'bg-muted text-muted-foreground border-border',
    icon: Ban,
  },
};

export const APPLICATION_STATUS_CONFIG: Record<ApplicationStatus, ApplicationStatusVisual> = {
  active: {
    label: 'Actif',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  creating: {
    label: 'Création',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dot: 'bg-amber-400',
  },
  failed: {
    label: 'Échec',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
    dot: 'bg-red-400',
  },
  archived: {
    label: 'Archivé',
    className: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
};

const FALLBACK_DEPLOYMENT: DeploymentStatusVisual = {
  label: 'Inconnu',
  className: 'bg-muted text-muted-foreground border-border',
  icon: Clock,
};

const FALLBACK_APPLICATION: ApplicationStatusVisual = {
  label: 'Inconnu',
  className: 'bg-muted text-muted-foreground border-border',
  dot: 'bg-muted-foreground',
};

export function getDeploymentStatus(status: string): DeploymentStatusVisual {
  return (
    DEPLOYMENT_STATUS_CONFIG[status as DeploymentStatus] ??
    (status === 'archived'
      ? {
          label: 'Archivé',
          className: 'bg-muted text-muted-foreground border-border',
          icon: Ban,
        }
      : FALLBACK_DEPLOYMENT)
  );
}

export function getApplicationStatus(status: string): ApplicationStatusVisual {
  return APPLICATION_STATUS_CONFIG[status as ApplicationStatus] ?? FALLBACK_APPLICATION;
}

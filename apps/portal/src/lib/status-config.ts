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
    className: 'bg-status-warning/10 text-status-warning border-status-warning/20',
    icon: Clock,
  },
  building: {
    label: 'En construction',
    className: 'bg-status-info/10 text-status-info border-status-info/20',
    icon: Hammer,
  },
  deploying: {
    label: 'Déploiement',
    className: 'bg-status-warning/10 text-status-warning border-status-warning/20',
    icon: Loader2,
  },
  healthy: {
    label: 'Succès',
    className: 'bg-status-success/10 text-status-success border-status-success/20',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Échec',
    className: 'bg-status-error/10 text-status-error border-status-error/20',
    icon: XCircle,
  },
  rolled_back: {
    label: 'Rollback',
    className: 'bg-status-warning/10 text-status-warning border-status-warning/20',
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
    className: 'bg-status-success/10 text-status-success border-status-success/20',
    dot: 'bg-status-success',
  },
  creating: {
    label: 'Création',
    className: 'bg-status-warning/10 text-status-warning border-status-warning/20',
    dot: 'bg-status-warning',
  },
  failed: {
    label: 'Échec',
    className: 'bg-status-error/10 text-status-error border-status-error/20',
    dot: 'bg-status-error',
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

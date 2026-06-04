import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, XCircle, Ban, Clock, ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const statusConfig: Record<string, { label: string; className: string; icon: LucideIcon }> = {
  pending: { label: 'En attente', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: Clock },
  building: { label: 'En cours', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Loader2 },
  deploying: { label: 'Déploiement', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Loader2 },
  healthy: { label: 'Succès', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  failed: { label: 'Échec', className: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
  rolled_back: { label: 'Rollback', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: ArrowLeft },
  cancelled: { label: 'Annulé', className: 'bg-muted text-muted-foreground border-border', icon: Ban },
};

interface StatusBadgeProps {
  status: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, showIcon = true }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const config = statusConfig[key] ?? { label: status, className: '', icon: Clock };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border',
        config.className,
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            'h-3.5 w-3.5',
            key === 'building' || key === 'deploying' ? 'animate-spin' : '',
          )}
        />
      )}
      {config.label}
    </span>
  );
}

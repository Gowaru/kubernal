import { cn } from '@/lib/utils';
import { getDeploymentStatus } from '@/lib/status-config';

interface StatusBadgeProps {
  status: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, showIcon = true }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const config = getDeploymentStatus(key);
  const Icon = config.icon;
  const spinning = key === 'building' || key === 'deploying';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border',
        config.className,
      )}
    >
      {showIcon && <Icon className={cn('h-3.5 w-3.5', spinning && 'animate-spin')} />}
      {config.label}
    </span>
  );
}

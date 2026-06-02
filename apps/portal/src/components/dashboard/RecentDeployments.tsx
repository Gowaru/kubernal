import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeployments } from '@/hooks/useDeployments';
import { useApplications } from '@/hooks/useApplications';
import { formatRelativeTime } from '@/lib/utils';
import type { DeploymentStatus } from '@kubernal/shared-types';

const statusConfig: Record<DeploymentStatus, { label: string; className: string }> = {
  pending: {
    label: 'En attente',
    className:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  },
  building: {
    label: 'En construction',
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  },
  deploying: {
    label: 'Déploiement',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
  healthy: {
    label: 'Succès',
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  },
  failed: {
    label: 'Échec',
    className:
      'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400 border-red-200 dark:border-red-800',
  },
  rolled_back: {
    label: 'Rollback',
    className:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  },
  cancelled: {
    label: 'Annulé',
    className:
      'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  },
};

function DeploymentSkeleton() {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export function RecentDeployments() {
  const { data: deployments, isLoading } = useDeployments();
  const { data: apps } = useApplications();

  const appMap = new Map(apps?.map((a) => [a.id, a.name]) ?? []);
  const recent = [...(deployments ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Déploiements récents</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <DeploymentSkeleton key={i} />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun déploiement récent
          </p>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((dep) => {
              const status = statusConfig[dep.status];
              return (
                <Link
                  key={dep.id}
                  to={`/deployments/${dep.id}`}
                  className="flex items-center justify-between py-3 transition-colors hover:bg-muted/50 -mx-2 px-2 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {appMap.get(dep.applicationId) ?? dep.applicationId.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(dep.createdAt)}
                    </p>
                  </div>
                  <Badge variant="outline" className={status.className}>
                    {status.label}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

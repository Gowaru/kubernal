import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeployments } from '@/hooks/useDeployments';
import { useApplications } from '@/hooks/useApplications';
import { formatRelativeTime } from '@/lib/utils';
import { getDeploymentStatus } from '@/lib/status-config';

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
              const status = getDeploymentStatus(dep.status);
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

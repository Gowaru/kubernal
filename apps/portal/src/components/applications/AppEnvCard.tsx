import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, GitBranch, Clock } from 'lucide-react';
import { formatRelativeTime, getEnvSlug } from '@/lib/utils';
import { StatusBadge } from '@/components/deployments/StatusBadge';
import type { Deployment } from '@kubernal/shared-types';

const envLabels: Record<string, string> = {
  dev: 'Development',
  staging: 'Staging',
  prod: 'Production',
};

const envColors: Record<string, string> = {
  dev: 'text-env-dev',
  staging: 'text-env-staging',
  prod: 'text-env-prod',
};

interface AppEnvCardProps {
  envId: string;
  deployments: Deployment[];
}

export function AppEnvCard({ envId, deployments }: AppEnvCardProps) {
  const envDeployments = deployments.filter((d) => getEnvSlug(d) === envId);
  const lastDeploy = [...envDeployments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];

  return (
    <Card className="transition-all duration-200 hover:border-accent/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className={`h-4 w-4 ${envColors[envId] ?? 'text-muted-foreground'}`} />
            {envLabels[envId] ?? envId}
          </CardTitle>
          {lastDeploy && <StatusBadge status={lastDeploy.status} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {lastDeploy ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Dernière version</span>
              <span className="flex items-center gap-1.5 font-mono text-xs">
                <GitBranch className="h-3 w-3 text-muted-foreground" />
                {lastDeploy.version}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Dernier déploiement</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(lastDeploy.createdAt)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Déploiements</span>
              <span className="font-medium">{envDeployments.length}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-2">Aucun déploiement</p>
        )}
      </CardContent>
    </Card>
  );
}

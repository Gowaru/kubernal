import { useEffect, type JSX } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useEnvironments } from '@/hooks/useEnvironments';
import { Cloud, Server, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { Environment } from '@kubernal/shared-types';

const envTypeConfig: Record<string, { label: string; icon: typeof Cloud; color: string }> = {
  dev: { label: 'Development', icon: Server, color: 'text-env-dev' },
  staging: { label: 'Staging', icon: AlertTriangle, color: 'text-env-staging' },
  prod: { label: 'Production', icon: ShieldAlert, color: 'text-env-prod' },
};

export default function Environments(): JSX.Element {
  const { data: envs, isLoading, error } = useEnvironments();

  useEffect(() => {
    if (error) {
      toast.error('Erreur lors du chargement des données', {
        description: (error as Error)?.message || 'Veuillez réessayer',
      });
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Environnements</h2>
          <p className="text-muted-foreground">
            Configuration et statut des environnements de déploiement.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const grouped = (envs ?? []).reduce<Record<string, Environment[]>>((acc, env) => {
    (acc[env.type] ??= []).push(env);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Environnements</h2>
        <p className="text-muted-foreground">
          Configuration et statut des environnements de déploiement.
        </p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <Server className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-medium">Aucun environnement</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Les environnements sont créés automatiquement lors du déploiement.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(grouped).map(([type, environments]) => {
            const config = envTypeConfig[type] ?? {
              label: type,
              icon: Cloud,
              color: 'text-muted-foreground',
            };
            const Icon = config.icon;
            return (
              <Card key={type} className="group transition-all duration-200 hover:border-accent/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      {config.label}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="bg-status-success/10 text-status-success border-status-success/20"
                    >
                      {environments.length} app{environments.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Server className="h-4 w-4" />
                    kubernal cluster
                  </div>
                  <div className="space-y-2">
                    {environments.map((env) => (
                      <div
                        key={env.id}
                        className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{env.name}</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-muted-foreground">{env.namespace}</code>
                          {env.requiresApproval && (
                            <CheckCircle2
                              className="h-3.5 w-3.5 text-status-warning"
                              aria-label="Approbation requise"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

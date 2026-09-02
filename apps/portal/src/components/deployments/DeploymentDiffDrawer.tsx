import { ArrowRight, GitCommit, GitBranch, Tag, Clock } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useDeploymentComparison } from '@/hooks/useDeployments';
import { DeploymentCommitLink } from './DeploymentCommitLink';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import type { Deployment } from '@kubernal/shared-types';
import type { JSX } from 'react';

interface DeploymentDiffDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromId: string | null;
  toId: string | null;
  repositoryUrl: string | null | undefined;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/30',
  building: 'bg-status-info/10 text-status-info border-status-info/30',
  deploying: 'bg-status-info/10 text-status-info border-status-info/30',
  healthy: 'bg-status-success/10 text-status-success border-status-success/30',
  failed: 'bg-status-error/10 text-status-error border-status-error/30',
  rolled_back: 'bg-status-warning/10 text-status-warning border-status-warning/30',
  cancelled: 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/30',
};

function duration(d: Deployment): string {
  if (!d.completedAt) return '—';
  const ms = new Date(d.completedAt).getTime() - new Date(d.startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function DeploymentDiffDrawer({
  open,
  onOpenChange,
  fromId,
  toId,
  repositoryUrl,
}: DeploymentDiffDrawerProps): JSX.Element {
  const { data, isLoading, error } = useDeploymentComparison(fromId, toId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
        data-testid="deployment-diff-drawer"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitCommit className="h-4 w-4" />
            Comparaison de déploiements
          </SheetTitle>
          <SheetDescription>
            {fromId && toId ? (
              <>
                {fromId.slice(0, 7)} <ArrowRight className="inline h-3 w-3" /> {toId.slice(0, 7)}
              </>
            ) : (
              'Sélectionnez deux déploiements à comparer'
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {error && (
            <div className="rounded-md border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error">
              Échec du chargement de la comparaison. {String(error.message)}
            </div>
          )}

          {data && (
            <>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">{data.summary}</p>
                {data.isPromotion && (
                  <p className="text-xs text-status-warning mt-1">
                    ⚠️ Promotion inter-environnements ({data.from.environmentType} →{' '}
                    {data.to.environmentType})
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Avant</span>
                  <span>Après</span>
                </div>

                {data.changes.length === 0 && data.durationDelta === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Aucun changement détecté.</p>
                ) : (
                  <div className="space-y-2">
                    {data.changes.map((change) => (
                      <div
                        key={change.field}
                        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-muted-foreground">
                            {change.field}
                          </span>
                          <span className="font-mono text-foreground break-all">
                            {change.from || '—'}
                          </span>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-muted-foreground">
                            {change.field}
                          </span>
                          <span className="font-mono text-foreground break-all">
                            {change.to || '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {data.durationDelta !== null && data.durationDelta !== 0 && (
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-muted-foreground">durée</span>
                          <span className="font-mono text-foreground">
                            {duration(data.from as unknown as Deployment)}
                          </span>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-muted-foreground">durée</span>
                          <span className="font-mono text-foreground">
                            {duration(data.to as unknown as Deployment)}{' '}
                            <span
                              className={
                                data.durationDelta > 0 ? 'text-status-error' : 'text-status-success'
                              }
                            >
                              ({data.durationDelta > 0 ? '+' : ''}
                              {Math.round(data.durationDelta / 1000)}s)
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DeploymentDiffCard
                title="Avant"
                deployment={data.from as unknown as Deployment}
                repositoryUrl={repositoryUrl}
                side="from"
              />
              <DeploymentDiffCard
                title="Après"
                deployment={data.to as unknown as Deployment}
                repositoryUrl={repositoryUrl}
                side="to"
              />
            </>
          )}

          {!isLoading && !data && !error && (
            <div className="text-sm text-muted-foreground">Aucune donnée à comparer.</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface DeploymentDiffCardProps {
  title: string;
  deployment: Deployment;
  repositoryUrl: string | null | undefined;
  side: 'from' | 'to';
}

function DeploymentDiffCard({
  title,
  deployment,
  repositoryUrl,
  side: _side,
}: DeploymentDiffCardProps): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Version</span>
          <span className="font-mono">{deployment.version}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Commit</span>
          <DeploymentCommitLink
            repositoryUrl={repositoryUrl}
            commitSha={deployment.commitSha}
            short
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Statut</span>
          <Badge
            variant="outline"
            className={`text-[10px] ${STATUS_BADGE[deployment.status] ?? STATUS_BADGE.pending}`}
          >
            {deployment.status}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Trigger</span>
          <span className="flex items-center gap-1">
            <Tag className="h-3 w-3" />
            {deployment.trigger}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Environnement</span>
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {deployment.environment?.type ?? '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Démarré</span>
          <span>{formatDate(deployment.startedAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Terminé</span>
          <span>
            {deployment.completedAt
              ? `${formatDate(deployment.completedAt)} (${formatRelativeTime(deployment.completedAt)})`
              : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Durée</span>
          <span className="flex items-center gap-1 font-mono">
            <Clock className="h-3 w-3" />
            {duration(deployment)}
          </span>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitCommit, Check, GitBranch, Clock, Layers, ArrowRight, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDeploymentsByApplication } from '@/hooks/useDeployments';
import { useEnvironments } from '@/hooks/useEnvironments';
import { DeploymentDiffDrawer } from './DeploymentDiffDrawer';
import { formatRelativeTime } from '@/lib/utils';
import type { Deployment } from '@kubernal/shared-types';

interface DeploymentHistoryTimelineProps {
  applicationId: string;
  applicationName: string;
  repositoryUrl: string | null | undefined;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  building: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  deploying: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/10 text-red-400 border-red-500/30',
  rolled_back: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  cancelled: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
};

const TRIGGER_LABEL: Record<string, string> = {
  manual: 'Manuel',
  git_push: 'Git push',
  scheduled: 'Planifié',
  rollback: 'Rollback',
  promote: 'Promotion',
};

export function DeploymentHistoryTimeline({
  applicationId,
  applicationName: _applicationName,
  repositoryUrl,
}: DeploymentHistoryTimelineProps): JSX.Element {
  const navigate = useNavigate();
  const { data: deployments, isLoading } = useDeploymentsByApplication(applicationId);
  const { data: environments } = useEnvironments();
  const [selectedFrom, setSelectedFrom] = useState<string | null>(null);
  const [selectedTo, setSelectedTo] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const groupedByEnv = useMemo(() => {
    const map = new Map<string, Deployment[]>();
    (deployments ?? []).forEach((d) => {
      const envId = d.environmentId;
      if (!map.has(envId)) map.set(envId, []);
      map.get(envId)?.push(d);
    });
    for (const [, list] of map) {
      list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return map;
  }, [deployments]);

  const toggleSelect = (id: string): void => {
    if (selectedFrom === id) {
      setSelectedFrom(null);
      return;
    }
    if (selectedTo === id) {
      setSelectedTo(null);
      return;
    }
    if (!selectedFrom) {
      setSelectedFrom(id);
    } else if (!selectedTo) {
      if (id !== selectedFrom) {
        setSelectedTo(id);
        setDrawerOpen(true);
      }
    } else {
      setSelectedFrom(id);
      setSelectedTo(null);
    }
  };

  const handleCompareClick = (): void => {
    if (selectedFrom && selectedTo) setDrawerOpen(true);
  };

  const canCompare = !!selectedFrom && !!selectedTo && selectedFrom !== selectedTo;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Historique des déploiements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!deployments || deployments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Historique des déploiements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucun déploiement pour cette application.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Historique des déploiements
              <span className="text-xs font-normal text-muted-foreground">
                ({deployments.length} total)
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {canCompare
                  ? `${selectedFrom?.slice(0, 7)} → ${selectedTo?.slice(0, 7)}`
                  : 'Sélectionner 2 déploiements'}
              </span>
              <Button
                size="sm"
                variant={canCompare ? 'default' : 'outline'}
                disabled={!canCompare}
                onClick={handleCompareClick}
              >
                <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                Comparer
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Cliquez sur 2 déploiements pour les comparer (version, commit, statut, durée).
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {Array.from(groupedByEnv.entries()).map(([envId, list]) => {
            const env = environments?.find((e) => e.id === envId);
            return (
              <div key={envId} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Layers className="h-3 w-3" />
                  <span>{env?.name ?? envId.slice(0, 8)}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {env?.type ?? '—'}
                  </Badge>
                  <span>·</span>
                  <span>{list.length} déploiement(s)</span>
                </div>
                <div className="relative pl-6 space-y-2 border-l-2 border-border ml-1.5">
                  {list.map((d) => {
                    const isFrom = selectedFrom === d.id;
                    const isTo = selectedTo === d.id;
                    const isSelected = isFrom || isTo;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleSelect(d.id)}
                        className={`group relative w-full text-left rounded-md border px-3 py-2 transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <span
                          className={`absolute -left-[31px] top-3 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background'
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5" />}
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-sm font-mono">{d.version}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${STATUS_BADGE[d.status] ?? STATUS_BADGE.pending}`}
                            >
                              {d.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {d.commitSha.slice(0, 7)}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {TRIGGER_LABEL[d.trigger] ?? d.trigger}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <GitCommit className="h-3 w-3" />
                              {formatRelativeTime(d.createdAt)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/deployments/${d.id}`);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Détails
                          </Button>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <DeploymentDiffDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        fromId={selectedFrom}
        toId={selectedTo}
        repositoryUrl={repositoryUrl}
      />
    </>
  );
}

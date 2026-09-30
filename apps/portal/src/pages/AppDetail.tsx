import { useState, useMemo, useCallback, useEffect, type JSX } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Rocket, Archive, Timer, List, Clock, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { usePagination } from '@/hooks/usePagination';
import { PaginationBar } from '@/components/ui/pagination-bar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useApplication,
  useArchiveApplication,
  useUpdateApplication,
} from '@/hooks/useApplications';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import { useTeam } from '@/hooks/useTeams';
import { useTemplate } from '@/hooks/useTemplates';
import { useDeployments } from '@/hooks/useDeployments';
import { AppStatsCards } from '@/components/applications/AppStatsCards';
import { AppInfoCard } from '@/components/applications/AppInfoCard';
import { AppEnvCard } from '@/components/applications/AppEnvCard';
import { StatusBadge } from '@/components/deployments/StatusBadge';
import { DeploymentModal } from '@/components/deployments/DeploymentModal';
import { DeploymentHistoryTimeline } from '@/components/deployments/DeploymentHistoryTimeline';
import { DeploymentCommitLink } from '@/components/deployments/DeploymentCommitLink';
import { WebhookConfigCard } from '@/components/webhooks/WebhookConfigCard';
import { WebhookOutboundCard } from '@/components/webhooks/WebhookOutboundCard';
import { useArgoSync } from '@/hooks/useArgoSync';
import { formatRelativeTime, getEnvSlug } from '@/lib/utils';
import { REPO_URL_REGEX } from '@/lib/repo-utils';
import { getApplicationStatus } from '@/lib/status-config';
import type { Application, Deployment } from '@kubernal/shared-types';

const ENVIRONMENT_IDS = ['dev', 'staging', 'prod'];

interface GitRepoDialogProps {
  application: Application;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Édition du dépôt Git / de la branche / du path des manifests.
 *
 * Écrit `PATCH /applications/:id` avec `repositoryUrl` + `config` (les defaults du
 * template sont conservés, `config.git` est ajouté ou retiré). `config.git` est le
 * signal qui bascule l'application en **mode Argo CD** côté backend.
 */
function GitRepoDialog({ application, open, onOpenChange }: GitRepoDialogProps): JSX.Element {
  const updateApplication = useUpdateApplication();
  const { busy: saving, acquire, release } = useSubmitLock(updateApplication.isPending);
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [path, setPath] = useState('.');
  const [error, setError] = useState<string | null>(null);

  const hasRepo = !!repo.trim();
  const argoEnabled = hasRepo && REPO_URL_REGEX.test(repo.trim());

  useEffect(() => {
    if (!open) return;
    const config = (application.config ?? {}) as Record<string, unknown>;
    const rawGit = config.git;
    const git =
      rawGit && typeof rawGit === 'object' && !Array.isArray(rawGit)
        ? (rawGit as Record<string, unknown>)
        : null;
    setRepo(application.repositoryUrl ?? '');
    setBranch(typeof git?.branch === 'string' && git.branch ? git.branch : 'main');
    setPath(typeof git?.path === 'string' && git.path ? git.path : '.');
    setError(null);
  }, [open, application]);

  const handleClose = (): void => {
    if (saving) return;
    onOpenChange(false);
  };

  const handleSave = async (): Promise<void> => {
    const trimmedRepo = repo.trim();
    if (trimmedRepo && !REPO_URL_REGEX.test(trimmedRepo)) {
      setError('URL invalide — GitHub, GitLab ou Bitbucket (.git attendu)');
      return;
    }
    if (!acquire()) return;
    setError(null);
    try {
      const config: Record<string, unknown> = { ...(application.config ?? {}) };
      if (trimmedRepo) {
        config.git = { branch: branch.trim() || 'main', path: path.trim() || '.' };
      } else {
        // Pas de dépôt → pas de mode Argo (un path sans repo n'a pas de sens).
        delete config.git;
      }
      await updateApplication.mutateAsync({
        id: application.id,
        repositoryUrl: trimmedRepo || null,
        config,
      });
      toast.success(
        trimmedRepo
          ? 'Dépôt Git mis à jour — Argo CD sera configuré au prochain déploiement'
          : 'Dépôt Git retiré — mode placeholder réactivé',
      );
      onOpenChange(false);
    } catch {
      toast.error('Impossible de mettre à jour le dépôt Git');
    } finally {
      release();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le dépôt Git</DialogTitle>
          <DialogDescription>
            Configurez le dépôt, la branche et le dossier des manifests synchronisés par Argo CD.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="git-repo-url">Dépôt Git</Label>
            <Input
              id="git-repo-url"
              placeholder="https://github.com/owner/repo.git"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
            {error && <p className="text-xs text-status-error">{error}</p>}
            {!hasRepo && (
              <p className="text-xs text-muted-foreground">
                Aucun dépôt : l'application utilise le mode placeholder (workload généré par la
                plateforme).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="git-branch">Branche</Label>
              <Input
                id="git-branch"
                placeholder="main"
                value={branch}
                disabled={!hasRepo}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="git-path">Path des manifests</Label>
              <Input
                id="git-path"
                placeholder="kustomize"
                value={path}
                disabled={!hasRepo}
                onChange={(e) => setPath(e.target.value)}
              />
            </div>
          </div>

          <p
            className={cn(
              'text-xs rounded-lg border p-3',
              argoEnabled
                ? 'border-border bg-muted/50 text-muted-foreground'
                : 'border-border bg-muted/30 text-muted-foreground',
            )}
          >
            {argoEnabled
              ? `Mode Argo CD : Argo clonera ${repo.trim()} (${branch.trim() || 'main'}) depuis "${path.trim() || '.'}" et pilotera les pods.`
              : 'Mode Argo CD désactivé.'}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving} aria-busy={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDuration(startedAt: string | Date, completedAt: string | Date | null): string {
  if (!completedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffMs = end - start;
  if (diffMs < 1000) return '<1s';
  if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`;
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.round((diffMs % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

export default function AppDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: application, isLoading, error } = useApplication(id!);
  const { data: team } = useTeam(application?.teamId ?? '');
  const { data: template } = useTemplate(application?.templateId ?? '');
  const { data: allDeployments } = useDeployments();
  const archiveMutation = useArchiveApplication();
  const {
    busy: archiving,
    acquire: acquireArchive,
    release: releaseArchive,
  } = useSubmitLock(archiveMutation.isPending);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showGitDialog, setShowGitDialog] = useState(false);

  const appDeployments = useMemo<Deployment[]>(() => {
    if (!allDeployments || !id) return [];
    return allDeployments.filter((d) => d.applicationId === id);
  }, [allDeployments, id]);

  const sortedDeployments = useMemo(
    () =>
      [...appDeployments].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [appDeployments],
  );

  const depPag = usePagination(sortedDeployments);

  const [tab, setTab] = useState<'recent' | 'history'>('recent');

  function AppEnvCardWithArgo({ envId }: { envId: string }): JSX.Element {
    const { data: argoStatus } = useArgoSync(application?.name ?? '', envId);
    return (
      <AppEnvCard key={envId} envId={envId} deployments={appDeployments} argoStatus={argoStatus} />
    );
  }

  const handleDeploy = useCallback(() => {
    setShowDeployModal(false);
  }, []);

  useEffect(() => {
    if (error) {
      toast.error('Application introuvable');
      navigate('/catalogue');
    }
  }, [error, application, navigate]);

  if (isLoading || !application) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const appStatus = getApplicationStatus(application.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/catalogue')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au catalogue
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setShowGitDialog(true)}>
            <GitBranch className="mr-2 h-4 w-4" />
            Modifier le dépôt Git
          </Button>
          <Button onClick={() => setShowDeployModal(true)}>
            <Rocket className="mr-2 h-4 w-4" />
            Déployer
          </Button>
          {!application.archivedAt && (
            <Button
              variant="outline"
              disabled={archiving}
              aria-busy={archiving}
              onClick={() => {
                if (!acquireArchive()) return;
                if (
                  !confirm(
                    `Archiver l'application "${application.name}" ? Elle ne sera plus visible dans le catalogue.`,
                  )
                ) {
                  releaseArchive();
                  return;
                }
                archiveMutation.mutate(id!, {
                  onSettled: () => releaseArchive(),
                });
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              {archiving ? 'Archivage…' : 'Archiver'}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{application.name}</h2>
          <Badge variant="outline" className={`flex items-center gap-1.5 ${appStatus.className}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${appStatus.dot}`} />
            {appStatus.label}
          </Badge>
        </div>
        {application.description && (
          <p className="text-muted-foreground">{application.description}</p>
        )}
        {application.repositoryUrl && (
          <p className="text-xs text-muted-foreground font-mono">{application.repositoryUrl}</p>
        )}
      </div>

      <AppStatsCards deployments={appDeployments} />

      <div className="grid gap-4 lg:grid-cols-3">
        <AppInfoCard
          team={team}
          template={template}
          ownerName={application.owner?.name}
          repositoryUrl={application.repositoryUrl}
          applicationId={application.id}
        />

        <div className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            {ENVIRONMENT_IDS.map((envId) => (
              <AppEnvCardWithArgo key={envId} envId={envId} />
            ))}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Déploiements</CardTitle>
            <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setTab('recent')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  tab === 'recent'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <List className="h-3 w-3" />
                Récents
              </button>
              <button
                type="button"
                onClick={() => setTab('history')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  tab === 'history'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Clock className="h-3 w-3" />
                Historique
                {appDeployments.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    {appDeployments.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tab === 'recent' && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Environnement</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="hidden sm:table-cell">Commit</TableHead>
                      <TableHead className="hidden sm:table-cell">Durée</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appDeployments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          Aucun déploiement pour cette application
                        </TableCell>
                      </TableRow>
                    ) : (
                      depPag.paginatedData.map((dep) => (
                        <TableRow key={dep.id}>
                          <TableCell>
                            <span className="font-mono text-sm">{dep.version}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {getEnvSlug(dep) ?? dep.environmentId}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={dep.status} />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <DeploymentCommitLink
                              repositoryUrl={application.repositoryUrl}
                              commitSha={dep.commitSha}
                              short
                            />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Timer className="h-3.5 w-3.5" />
                              {formatDuration(dep.startedAt, dep.completedAt)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatRelativeTime(dep.createdAt)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="border-t border-border px-4 py-2">
                <PaginationBar
                  pagination={depPag}
                  onPageChange={depPag.setPage}
                  onPageSizeChange={depPag.setPageSize}
                />
              </div>
            </>
          )}
          {tab === 'history' && (
            <div className="p-4 pt-0">
              <DeploymentHistoryTimeline
                applicationId={id!}
                applicationName={application.name}
                repositoryUrl={application.repositoryUrl}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {application.repositoryUrl && (
          <WebhookConfigCard
            applicationId={application.id}
            repositoryUrl={application.repositoryUrl}
          />
        )}
        <WebhookOutboundCard applicationId={application.id} />
      </div>

      <GitRepoDialog
        application={application}
        open={showGitDialog}
        onOpenChange={setShowGitDialog}
      />

      <DeploymentModal
        open={showDeployModal}
        onOpenChange={setShowDeployModal}
        preselectedApp={application}
        onDeploy={handleDeploy}
      />
    </div>
  );
}

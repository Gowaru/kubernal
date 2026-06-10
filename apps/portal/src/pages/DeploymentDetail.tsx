import { useState, useMemo, useCallback, useEffect, type JSX } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUp, ExternalLink, GitBranch, User, Calendar, Timer, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDeployment, useDeploymentViolations, useApproveDeployment } from '@/hooks/useDeployments';
import { useApplications } from '@/hooks/useApplications';
import { useUsers } from '@/hooks/useUsers';
import { useEnvironments } from '@/hooks/useEnvironments';
import { useK8sPods } from '@/hooks/useK8sPods';
import { useArgoSync } from '@/hooks/useArgoSync';
import { useCrossplaneClaims } from '@/hooks/useCrossplaneClaims';
import { useHPA } from '@/hooks/useHPA';
import { useK8sEvents } from '@/hooks/useK8sEvents';
import { useClusterInfo } from '@/hooks/useClusterInfo';
import { usePipelinesByDeployment } from '@/hooks/usePipelines';
import { PipelineStepsTimeline } from '@/components/pipelines/PipelineStepsTimeline';
import { CveDrawer } from '@/components/pipelines/CveDrawer';
import { K8sContextBar } from '@/components/k8s/K8sContextBar';
import { ArgoSyncBadge } from '@/components/k8s/ArgoSyncBadge';
import { InfrastructureClaims } from '@/components/k8s/InfrastructureClaims';
import { PodGrid } from '@/components/k8s/PodGrid';
import { ResourceGauge } from '@/components/k8s/ResourceGauge';
import { ScaleControl } from '@/components/k8s/ScaleControl';
import { K8sActionsBar } from '@/components/k8s/K8sActionsBar';
import { K8sEventFeed } from '@/components/k8s/K8sEventFeed';
import { PodLogDrawer } from '@/components/k8s/PodLogDrawer';
import { StatusBadge } from '@/components/deployments/StatusBadge';
import { ViolationsList } from '@/components/deployments/ViolationsList';
import { PromoteModal } from '@/components/deployments/PromoteModal';
import { DeploymentCommitLink } from '@/components/deployments/DeploymentCommitLink';
import { DeploymentAccessCard } from '@/components/deployments/DeploymentAccessCard';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { k8sResourceName } from '@/lib/k8s-utils';
import type { Deployment, K8sPod } from '@kubernal/shared-types';

const triggerLabels: Record<string, string> = {
  manual: 'Manuel',
  git_push: 'Git Push',
  scheduled: 'Planifié',
  rollback: 'Rollback',
};

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

export default function DeploymentDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: deployment, isLoading, error } = useDeployment(id!);
  const { data: violations } = useDeploymentViolations(id!);
  const { data: applications } = useApplications();
  const { data: users } = useUsers();
  const { data: environments } = useEnvironments();
  const { data: clusterInfo } = useClusterInfo();

  const appName = useMemo(() => {
    if (!applications || !deployment) return '';
    const app = applications.find((a) => a.id === deployment.applicationId);
    return app?.name ?? deployment.applicationId.slice(0, 8);
  }, [applications, deployment]);

  const repositoryUrl = useMemo(() => {
    if (!applications || !deployment) return null;
    const app = applications.find((a) => a.id === deployment.applicationId);
    return app?.repositoryUrl ?? null;
  }, [applications, deployment]);

  const appId = (appName || 'unknown').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const envId = deployment?.environment?.type ?? 'prod';
  const namespace = deployment?.environment?.namespace ?? `prod-${appId}`;
  const k8sName = k8sResourceName(appId, envId);
  const clusterReady = !!clusterInfo && clusterInfo.name !== 'unknown' && clusterInfo.nodeCount > 0;

  const { data: pods } = useK8sPods(namespace, undefined, `app=${appId},env=${envId},version=${deployment?.version ?? ''}`);
  const { data: argoStatus } = useArgoSync(appId, envId);
  const { data: claimsData } = useCrossplaneClaims(namespace);
  const { data: hpaData } = useHPA(namespace);
  const { data: events } = useK8sEvents(namespace);

  const { data: pipelinesByDeployment } = usePipelinesByDeployment(id);
  const firstPipeline = pipelinesByDeployment?.[0] ?? null;

  const [cveDeploymentId, setCveDeploymentId] = useState<string | null>(null);
  const [selectedPod, setSelectedPod] = useState<K8sPod | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveStep, setApproveStep] = useState<'confirm' | 'progress' | 'success'>('confirm');
  const [approveProgress, setApproveProgress] = useState(0);
  const [showPromoteModal, setShowPromoteModal] = useState(false);

  const approveDeployment = useApproveDeployment();

  const isPending = deployment?.status === 'pending';
  const isHealthy = deployment?.status === 'healthy';

  const nextEnv = useMemo(() => {
    if (!deployment || !environments || !deployment.environment) return null;
    const flow: Record<string, 'staging' | 'prod'> = { dev: 'staging', staging: 'prod' };
    const nextType = flow[deployment.environment.type];
    if (!nextType) return null;
    return environments.find(
      (e) => e.applicationId === deployment.applicationId && e.type === nextType,
    ) ?? null;
  }, [deployment, environments]);

  const defaultArgoStatus = argoStatus ?? {
    sync: 'Unknown' as const,
    health: 'Unknown' as const,
    revision: deployment?.commitSha ?? 'unknown',
    branch: 'main',
    lastSyncAt: null,
    message: null,
  };

  const handleApprove = useCallback(() => {
    if (!id) return;
    setShowApproveModal(true);
    setApproveStep('progress');
    setApproveProgress(0);

    const userId = users?.[0]?.id ?? '';
    const userName = users?.[0]?.name ?? 'Vous';
    const userEmail = users?.[0]?.email ?? '';

    approveDeployment.mutate(
      { id, approvedById: userId },
      {
        onSuccess: () => {
          queryClient.setQueryData(['deployments', id], (old: Deployment | undefined) => {
            if (!old) return old;
            return { ...old, status: 'deploying', approvedBy: { id: userId, name: userName, email: userEmail } };
          });
        },
        onError: () => {
          toast.error("Erreur lors de l'approbation");
        },
      },
    );

    const interval = setInterval(() => {
      setApproveProgress((p) => {
        const next = Math.min(p + Math.random() * 20, 100);
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setApproveStep('success');
            toast.success('Déploiement approuvé avec succès');
          }, 300);
        }
        return next;
      });
    }, 350);
  }, [id, approveDeployment, queryClient, users]);

  useEffect(() => {
    if (error) {
      toast.error('Déploiement introuvable');
      navigate('/deployments');
    }
  }, [error, navigate]);

  if (isLoading || !deployment) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/deployments')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux déploiements
        </Button>
        <div className="flex items-center gap-2">
          {isHealthy && nextEnv && (
            <Button
              variant="outline"
              onClick={() => setShowPromoteModal(true)}
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Promouvoir vers {nextEnv.type === 'staging' ? 'Staging' : 'Production'}
            </Button>
          )}
          {isPending && (
            <Button
              onClick={() => setShowApproveModal(true)}
              disabled={!users?.length}
              title={!users?.length ? 'Aucun utilisateur' : undefined}
            >
              Approuver le déploiement
            </Button>
          )}
        </div>
      </div>

      {clusterInfo && (
        <K8sContextBar
          cluster={clusterInfo}
          namespace={namespace}
          branch={defaultArgoStatus.branch}
          revision={defaultArgoStatus.revision}
        />
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-bold tracking-tight">
            {appName}{' '}
            <span className="text-muted-foreground font-mono text-lg">{deployment.version}</span>
          </h2>
          <StatusBadge status={deployment.status} />
          <ArgoSyncBadge
            sync={isPending ? 'Unknown' : defaultArgoStatus.sync}
            health={isPending ? 'Unknown' : defaultArgoStatus.health}
          />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5" />{triggerLabels[deployment.trigger] ?? deployment.trigger}</span>
          <span>·</span>
          <span className="font-mono">
            <DeploymentCommitLink
              repositoryUrl={repositoryUrl}
              commitSha={deployment.commitSha ?? ''}
              short
            />
          </span>
          <span>·</span>
          <span>{formatRelativeTime(deployment.createdAt)}</span>
          {deployment.approvedBy && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Approuvé par {deployment.approvedBy.name}</span>
            </>
          )}
        </div>
        <K8sActionsBar
          argoStatus={defaultArgoStatus}
          namespace={namespace}
          deploymentName={k8sName}
          clusterReady={clusterReady}
        />
      </div>

      <DeploymentAccessCard deploymentId={id!} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {firstPipeline ? (
            <PipelineStepsTimeline
              pipelineId={firstPipeline.id}
              deploymentId={deployment.id}
              onShowCves={(did) => setCveDeploymentId(did)}
            />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Aucun pipeline exécuté</p>
          )}
        </CardContent>
      </Card>

      {claimsData && claimsData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Claims Crossplane</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <InfrastructureClaims claims={claimsData} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Pods{' '}
              {hpaData && pods && pods.length > 0 && (
                <span className="text-sm font-mono text-muted-foreground">
                  ({pods.length} replicas)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {pods && pods.length > 0 ? (
              <PodGrid pods={pods} selectedPodId={selectedPod?.id} onPodSelect={setSelectedPod} />
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Aucun pod trouvé</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {hpaData && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resources</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResourceGauge resources={hpaData.resources} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Scale (HPA)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScaleControl hpa={hpaData.hpa} namespace={namespace} deploymentName={k8sName} clusterReady={clusterReady} />
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Timer className="h-4 w-4" />Exécution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />Démarré : {formatDate(deployment.startedAt)}
              </div>
              {deployment.completedAt && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />Terminé : {formatDate(deployment.completedAt)}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Timer className="h-3 w-3" />Durée : {formatDuration(deployment.startedAt, deployment.completedAt)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {events && events.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Événements récents</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <K8sEventFeed events={events} />
          </CardContent>
        </Card>
      )}

      {violations && violations.length > 0 && (
        <ViolationsList violations={violations} />
      )}

      {deployment.artifacts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Artefacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deployment.artifacts.map((artifact, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm font-mono truncate">{artifact.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{artifact.size}</span>
                <Button variant="ghost" size="sm" className="h-7 shrink-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <CveDrawer
        deploymentId={cveDeploymentId}
        open={!!cveDeploymentId}
        onClose={() => setCveDeploymentId(null)}
      />

      <PodLogDrawer pod={selectedPod} onClose={() => setSelectedPod(null)} />

      <Dialog open={showApproveModal} onOpenChange={(open) => { if (!open) setShowApproveModal(false); }}>
        <DialogContent className="sm:max-w-md">
          {approveStep === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle>Approuver le déploiement</DialogTitle>
                <DialogDescription>
                  Voulez-vous approuver le déploiement {deployment.version} ?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowApproveModal(false)}>
                  Annuler
                </Button>
                <Button onClick={handleApprove}>
                  Confirmer l'approbation
                </Button>
              </DialogFooter>
            </>
          )}
          {approveStep === 'progress' && (
            <>
              <DialogHeader>
                <DialogTitle>Approbation en cours</DialogTitle>
                <DialogDescription>Validation des politiques de sécurité...</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progression</span>
                    <span className="font-medium">{Math.round(approveProgress)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${approveProgress}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {approveProgress < 40 && 'Vérification des politiques...'}
                  {approveProgress >= 40 && approveProgress < 70 && 'Analyse des violations...'}
                  {approveProgress >= 70 && approveProgress < 90 && 'Validation des règles de déploiement...'}
                  {approveProgress >= 90 && 'Finalisation...'}
                </p>
              </div>
            </>
          )}
          {approveStep === 'success' && (
            <>
              <DialogHeader>
                <DialogTitle>Déploiement approuvé !</DialogTitle>
                <DialogDescription>Le déploiement a été approuvé et est en cours d'exécution.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <CheckCircle2 className="h-16 w-16 text-status-success" />
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Le déploiement <strong className="text-foreground">{deployment.version}</strong> a été approuvé avec succès.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowApproveModal(false); setApproveStep('confirm'); }}>
                  Terminé
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {deployment && nextEnv && (
        <PromoteModal
          open={showPromoteModal}
          onOpenChange={setShowPromoteModal}
          deploymentId={deployment.id}
          version={deployment.version}
          sourceEnv={deployment.environment!}
          targetEnv={nextEnv}
          onPromoted={(newId) => navigate(`/deployments/${newId}`)}
        />
      )}
    </div>
  );
}

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Box, ExternalLink, Timer, GitBranch, User, Calendar, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDeployment, useDeploymentViolations, useApproveDeployment } from '@/hooks/useDeployments';
import { useApplications } from '@/hooks/useApplications';
import { StatusBadge } from '@/components/deployments/StatusBadge';
import { PipelineTimeline } from '@/components/deployments/PipelineTimeline';
import { BuildLogs } from '@/components/deployments/BuildLogs';
import { ViolationsList } from '@/components/deployments/ViolationsList';
import { formatDate, formatRelativeTime } from '@/lib/utils';

const triggerLabels: Record<string, string> = {
  manual: 'Manuel',
  git_push: 'Git Push',
  scheduled: 'Planifié',
  rollback: 'Rollback',
};

const envLabels: Record<string, string> = {
  dev: 'Development',
  staging: 'Staging',
  prod: 'Production',
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

export default function DeploymentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: deployment, isLoading, error } = useDeployment(id!);
  const { data: violations } = useDeploymentViolations(id!);
  const { data: applications } = useApplications();
  const approveDeployment = useApproveDeployment();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveStep, setApproveStep] = useState<'confirm' | 'progress' | 'success'>('confirm');
  const [approveProgress, setApproveProgress] = useState(0);

  const appName = useMemo(() => {
    if (!applications || !deployment) return '';
    const app = applications.find((a) => a.id === deployment.applicationId);
    return app?.name ?? deployment.applicationId.slice(0, 8);
  }, [applications, deployment]);

  const isPending = deployment?.status === 'pending';
  const envLabel = deployment?.environment?.type
    ? (envLabels[deployment.environment.type] ?? deployment.environment.type)
    : (deployment?.environmentId ?? '');

  const handleApprove = useCallback(() => {
    if (!id) return;
    setShowApproveModal(true);
    setApproveStep('progress');
    setApproveProgress(0);

    approveDeployment.mutate(id, {
      onSuccess: () => {
        queryClient.setQueryData(['deployments', id], (old: any) => {
          if (!old) return old;
          return { ...old, status: 'running', approvedBy: { id: 'optimistic', name: 'Vous', email: '' } };
        });
      },
      onError: () => { toast.error("Erreur lors de l'approbation"); },
    });

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
  }, [id, approveDeployment, queryClient]);

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
        {isPending && (
          <Button onClick={() => setShowApproveModal(true)}>
            Approuver le déploiement
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">
            Déploiement {deployment.version}
          </h2>
          <StatusBadge status={deployment.status} />
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{appName}</span>
          <span>·</span>
          <span>{envLabel}</span>
          <span>·</span>
          <span>{formatRelativeTime(deployment.createdAt)}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Box className="h-4 w-4" />
              Application
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-medium">{appName}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3" />
              {deployment.version}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Déclencheur :</span>
              {triggerLabels[deployment.trigger] ?? deployment.trigger}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ExternalLink className="h-4 w-4" />
              Environnement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-medium">
              {envLabel}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Commit :</span>
              <span className="font-mono">{deployment.commitSha?.slice(0, 7) ?? '-'}</span>
            </div>
            {deployment.approvedBy && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                Approuvé par : {deployment.approvedBy.name}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Timer className="h-4 w-4" />
              Exécution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Démarré : {formatDate(deployment.startedAt)}
            </div>
            {deployment.completedAt && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Terminé : {formatDate(deployment.completedAt)}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              Durée : {formatDuration(deployment.startedAt, deployment.completedAt)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <PipelineTimeline status={deployment.status} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Logs de build</CardTitle>
            </CardHeader>
            <CardContent className="p-0 px-4 pb-4">
              <BuildLogs status={deployment.status} />
            </CardContent>
          </Card>

          {deployment.artifacts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Artefacts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {deployment.artifacts.map((artifact, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
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
        </div>
      </div>

      {violations && violations.length > 0 && (
        <ViolationsList violations={violations} />
      )}

      <Dialog open={showApproveModal} onOpenChange={(open) => { if (!open) setShowApproveModal(false); }}>
        <DialogContent className="sm:max-w-md">
          {approveStep === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle>Approuver le déploiement</DialogTitle>
                <DialogDescription>
                  Voulez-vous approuver le déploiement {deployment.version} sur{' '}
                  {envLabel}&nbsp;?
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
                <DialogDescription>
                  Validation des politiques de sécurité...
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progression</span>
                    <span className="font-medium">{Math.round(approveProgress)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
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
                <DialogDescription>
                  Le déploiement a été approuvé et est en cours d'exécution.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <CheckCircle2 className="h-16 w-16 text-emerald-400" />
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Le déploiement <strong className="text-foreground">{deployment.version}</strong> sur{' '}
                  <strong className="text-foreground">
              {envLabel}
                  </strong>{' '}
                  a été approuvé avec succès.
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
    </div>
  );
}

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Rocket, Archive, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApplication } from '@/hooks/useApplications';
import { useTeam } from '@/hooks/useTeams';
import { useTemplate } from '@/hooks/useTemplates';
import { useDeployments } from '@/hooks/useDeployments';
import { AppStatsCards } from '@/components/applications/AppStatsCards';
import { AppInfoCard } from '@/components/applications/AppInfoCard';
import { AppEnvCard } from '@/components/applications/AppEnvCard';
import { StatusBadge } from '@/components/deployments/StatusBadge';
import { DeploymentModal } from '@/components/deployments/DeploymentModal';
import { formatRelativeTime, getEnvSlug } from '@/lib/utils';
import type { Deployment } from '@kubernal/shared-types';

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  active: {
    label: 'Actif',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  creating: {
    label: 'Création',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dot: 'bg-amber-400',
  },
  failed: {
    label: 'Échec',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
    dot: 'bg-red-400',
  },
  archived: {
    label: 'Archivé',
    className: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
};

const ENVIRONMENT_IDS = ['dev', 'staging', 'prod'];

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

export default function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: application, isLoading, error } = useApplication(id!);
  const { data: team } = useTeam(application?.teamId ?? '');
  const { data: template } = useTemplate(application?.templateId ?? '');
  const { data: allDeployments } = useDeployments();
  const [showDeployModal, setShowDeployModal] = useState(false);

  const appDeployments = useMemo<Deployment[]>(() => {
    if (!allDeployments || !id) return [];
    return allDeployments.filter((d) => d.applicationId === id);
  }, [allDeployments, id]);

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

  const appStatus = STATUS_CONFIG[application.status] ?? STATUS_CONFIG.archived;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/catalogue')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au catalogue
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowDeployModal(true)}>
            <Rocket className="mr-2 h-4 w-4" />
            Déployer
          </Button>
          <Button variant="outline" disabled>
            <Archive className="mr-2 h-4 w-4" />
            Archiver
          </Button>
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
        />

        <div className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            {ENVIRONMENT_IDS.map((envId) => (
              <AppEnvCard key={envId} envId={envId} deployments={appDeployments} />
            ))}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Déploiements récents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Environnement</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden sm:table-cell">Durée</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appDeployments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Aucun déploiement pour cette application
                  </TableCell>
                </TableRow>
              ) : (
                appDeployments
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                  )
                  .slice(0, 10)
                  .map((dep) => (
                    <TableRow key={dep.id}>
                      <TableCell>
                        <span className="font-mono text-sm">{dep.version}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{getEnvSlug(dep) ?? dep.environmentId}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={dep.status} />
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
        </CardContent>
      </Card>

      <DeploymentModal
        open={showDeployModal}
        onOpenChange={setShowDeployModal}
        preselectedApp={application}
        onDeploy={handleDeploy}
      />
    </div>
  );
}

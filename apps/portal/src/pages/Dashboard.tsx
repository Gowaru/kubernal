import { useEffect, type JSX } from 'react';
import { AppWindow, Rocket, CheckCircle2, XCircle, Activity, Database } from 'lucide-react';
import { toast } from 'sonner';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import { DeploymentChart } from '@/components/dashboard/DeploymentChart';
import { RecentDeployments } from '@/components/dashboard/RecentDeployments';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useApplications } from '@/hooks/useApplications';
import { useDeployments } from '@/hooks/useDeployments';

function computeDeploymentTrend(
  deployments: { createdAt: Date | string }[] | undefined,
): { value: number; positive: boolean } | undefined {
  if (!deployments || deployments.length === 0) return undefined;
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const recent = deployments.filter((d) => new Date(d.createdAt) >= threeDaysAgo).length;
  const previous = deployments.filter((d) => {
    const dDate = new Date(d.createdAt);
    return dDate >= sixDaysAgo && dDate < threeDaysAgo;
  }).length;
  if (previous === 0 && recent === 0) return undefined;
  if (previous === 0) return { value: 100, positive: true };
  if (recent === 0) return undefined;
  const change = Math.round(((recent - previous) / previous) * 100);
  if (change === 0) return undefined;
  return { value: Math.abs(change), positive: change > 0 };
}

function computeUptime(deployments: { status: string }[] | undefined): string {
  if (!deployments || deployments.length === 0) return 'N/A';
  const up = deployments.filter((d) =>
    ['healthy', 'building', 'deploying', 'pending'].includes(d.status),
  ).length;
  const down = deployments.filter((d) =>
    ['failed', 'rolled_back', 'cancelled'].includes(d.status),
  ).length;
  const total = up + down;
  if (total === 0) return 'N/A';
  return `${((up / total) * 100).toFixed(2)}%`;
}

export default function Dashboard(): JSX.Element {
  const { data: apps, isLoading: appsLoading, error: appsError } = useApplications();
  const {
    data: deployments,
    isLoading: deploymentsLoading,
    error: deploymentsError,
  } = useDeployments();

  const isLoading = appsLoading || deploymentsLoading;

  useEffect(() => {
    if (appsError) {
      toast.error('Erreur lors du chargement des données', {
        description: (appsError as Error)?.message || 'Veuillez réessayer',
      });
    }
  }, [appsError]);

  useEffect(() => {
    if (deploymentsError) {
      toast.error('Erreur lors du chargement des données', {
        description: (deploymentsError as Error)?.message || 'Veuillez réessayer',
      });
    }
  }, [deploymentsError]);
  const successCount = deployments?.filter((d) => d.status === 'healthy').length ?? 0;
  const failedCount = deployments?.filter((d) => d.status === 'failed').length ?? 0;
  const totalDeployments = deployments?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tableau de bord</h2>
          <p className="text-muted-foreground">Vue d'ensemble de votre plateforme</p>
        </div>
      </div>

      <WelcomeCard />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : apps && apps.length === 0 && totalDeployments === 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Applications"
              value={0}
              icon={AppWindow}
              description="Applications déployées"
            />
            <StatsCard
              title="Déploiements"
              value={0}
              icon={Rocket}
              description="Total des déploiements"
            />
            <StatsCard
              title="Succès / Échecs"
              value="0 / 0"
              icon={Activity}
              description="Déploiements récents"
            />
            <StatsCard
              title="Uptime"
              value="N/A"
              icon={Activity}
              description="Uptime moyen (7 jours)"
            />
          </div>
          <Alert>
            <Database className="h-4 w-4" />
            <AlertTitle>Aucune donnée dans la base</AlertTitle>
            <AlertDescription>
              La plateforme semble vide. Créez votre première application depuis le{' '}
              <a
                href="/catalogue"
                className="font-medium underline underline-offset-4 hover:text-primary"
              >
                catalogue
              </a>{' '}
              ou exécutez{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                npm run db:seed
              </code>{' '}
              pour charger les données de démonstration.
            </AlertDescription>
          </Alert>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Applications"
            value={apps?.length ?? 0}
            icon={AppWindow}
            description="Applications déployées"
          />
          <StatsCard
            title="Déploiements"
            value={totalDeployments}
            icon={Rocket}
            description="Total des déploiements"
            trend={computeDeploymentTrend(deployments)}
          />
          <StatsCard
            title="Succès / Échecs"
            value={`${successCount} / ${failedCount}`}
            icon={successCount > failedCount ? CheckCircle2 : XCircle}
            description="Déploiements récents"
          />
          <StatsCard
            title="Uptime"
            value={computeUptime(deployments)}
            icon={Activity}
            description="Uptime moyen (7 jours)"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DeploymentChart deployments={deployments ?? []} />
        </div>
        <QuickActions />
      </div>

      <RecentDeployments />
    </div>
  );
}

import { AppWindow, Rocket, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import { DeploymentChart } from '@/components/dashboard/DeploymentChart';
import { RecentDeployments } from '@/components/dashboard/RecentDeployments';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Skeleton } from '@/components/ui/skeleton';
import { useApplications } from '@/hooks/useApplications';
import { useDeployments } from '@/hooks/useDeployments';

function computeDeploymentTrend(deployments: { createdAt: Date | string }[] | undefined) {
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

function computeUptime(deployments: { status: string }[] | undefined) {
  if (!deployments || deployments.length === 0) return 'N/A';
  const healthy = deployments.filter((d) => d.status === 'healthy').length;
  const failed = deployments.filter((d) => d.status === 'failed').length;
  const total = healthy + failed;
  if (total === 0) return 'N/A';
  return `${((healthy / total) * 100).toFixed(2)}%`;
}

export default function Dashboard() {
  const { data: apps, isLoading: appsLoading } = useApplications();
  const { data: deployments, isLoading: deploymentsLoading } = useDeployments();

  const isLoading = appsLoading || deploymentsLoading;
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

import { AppWindow, Rocket, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import { DeploymentChart } from '@/components/dashboard/DeploymentChart';
import { RecentDeployments } from '@/components/dashboard/RecentDeployments';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { useApplications } from '@/hooks/useApplications';
import { useDeployments } from '@/hooks/useDeployments';

export default function Dashboard() {
  const { data: apps } = useApplications();
  const { data: deployments } = useDeployments();

  const successCount = deployments?.filter((d) => d.status === 'healthy').length ?? 0;
  const failedCount = deployments?.filter((d) => d.status === 'failed').length ?? 0;
  const totalDeployments = deployments?.length ?? 0;

  return (
    <div className="space-y-6">
      <WelcomeCard />

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
          trend={totalDeployments > 0 ? { value: 12, positive: true } : undefined}
        />
        <StatsCard
          title="Succès / Échecs"
          value={`${successCount} / ${failedCount}`}
          icon={successCount > failedCount ? CheckCircle2 : XCircle}
          description="Déploiements récents"
        />
        <StatsCard
          title="Uptime"
          value="99.97%"
          icon={Activity}
          description="Uptime moyen (7 jours)"
          trend={{ value: 0.02, positive: true }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DeploymentChart />
        </div>
        <QuickActions />
      </div>

      <RecentDeployments />
    </div>
  );
}

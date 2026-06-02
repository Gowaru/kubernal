import { useMemo } from 'react';
import { GitBranch, CheckCircle2, Tag, TrendingUp, Cpu, MemoryStick } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import type { Deployment } from '@kubernal/shared-types';

interface AppStatsCardsProps {
  deployments: Deployment[];
  appId?: string;
}

export function AppStatsCards({ deployments, appId }: AppStatsCardsProps) {
  const totalDeployments = deployments.length;

  const uniqueEnvs = useMemo(() => {
    const set = new Set(deployments.map((d) => d.environmentId));
    return set.size;
  }, [deployments]);

  const uniqueVersions = useMemo(() => {
    const set = new Set(deployments.map((d) => d.version));
    return set.size;
  }, [deployments]);

  const successRate = useMemo(() => {
    if (!totalDeployments) return 0;
    const successes = deployments.filter((d) => d.status === 'healthy').length;
    return Math.round((successes / totalDeployments) * 100);
  }, [deployments, totalDeployments]);

  const simulatedMetrics = useMemo(() => {
    if (!appId) return { cpu: 35, ramUsed: 1.8, ramTotal: 4 };
    const seed = appId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const cpu = (seed % 30) + 20;
    const ramSeed = ((seed * 7) % 20) + 10;
    const ramUsed = Math.round((ramSeed / 100) * 4 * 10) / 10;
    return { cpu, ramUsed, ramTotal: 4 };
  }, [appId]);

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <StatsCard
        title="Déploiements"
        value={totalDeployments}
        icon={GitBranch}
      />
      <StatsCard
        title="Envs actifs"
        value={`${uniqueEnvs}/3`}
        icon={CheckCircle2}
      />
      <StatsCard
        title="Versions"
        value={uniqueVersions}
        icon={Tag}
      />
      <StatsCard
        title="Succès"
        value={`${successRate}%`}
        icon={TrendingUp}
        trend={
          successRate >= 80
            ? { value: successRate, positive: true }
            : { value: 100 - successRate, positive: false }
        }
      />
      <StatsCard
        title="CPU"
        value={`${simulatedMetrics.cpu}%`}
        icon={Cpu}
        description="Utilisation moyenne"
      />
      <StatsCard
        title="RAM"
        value={`${simulatedMetrics.ramUsed}/${simulatedMetrics.ramTotal} Go`}
        icon={MemoryStick}
        description="Utilisation"
      />
    </div>
  );
}

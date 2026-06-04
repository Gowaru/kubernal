import { useMemo } from 'react';
import { GitBranch, CheckCircle2, Tag, TrendingUp } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { getEnvSlug } from '@/lib/utils';
import type { Deployment } from '@kubernal/shared-types';

interface AppStatsCardsProps {
  deployments: Deployment[];
}

export function AppStatsCards({ deployments }: AppStatsCardsProps) {
  const totalDeployments = deployments.length;

  const uniqueEnvs = useMemo(() => {
    const activeStatuses = new Set(['healthy', 'deploying', 'building', 'pending']);
    return new Set(
      deployments
        .filter((d) => activeStatuses.has(d.status))
        .map((d) => getEnvSlug(d))
        .filter((slug): slug is string => !!slug),
    ).size;
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

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
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
    </div>
  );
}

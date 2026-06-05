import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface DeploymentAccessInfo {
  namespace: string;
  deployment: string;
  type: 'nodeport' | 'clusterip' | 'none';
  urls: Array<{
    port: number;
    nodePort?: number;
    url: string;
    kind: 'nodeport' | 'portforward' | 'internal';
  }>;
  serviceName: string | null;
  serviceType: string | null;
  ports: Array<{ name: string; port: number; nodePort: number | null; protocol: string }>;
  suggestion: string | null;
}

export function useDeploymentAccess(
  deploymentId: string | undefined,
  cluster?: string,
): UseQueryResult<DeploymentAccessInfo, Error> {
  return useQuery<DeploymentAccessInfo>({
    queryKey: ['deployment-access', deploymentId, cluster ?? 'kubernal-prod'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: DeploymentAccessInfo }>(
        `/deployments/${deploymentId}/access`,
        { params: cluster ? { cluster } : undefined },
      );
      return data.data;
    },
    enabled: !!deploymentId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

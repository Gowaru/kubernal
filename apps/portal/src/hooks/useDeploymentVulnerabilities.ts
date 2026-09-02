import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface DeploymentVulnerability {
  id: string;
  deploymentId: string;
  cveId: string;
  severity: string;
  packageName: string;
  packageVersion: string;
  fixedVersion: string | null;
  title: string;
  description: string | null;
  scanSource: string;
  detectedAt: string;
}

export function useDeploymentVulnerabilities(
  deploymentId: string | undefined,
): UseQueryResult<DeploymentVulnerability[], Error> {
  return useQuery<DeploymentVulnerability[]>({
    queryKey: ['deployments', deploymentId, 'vulnerabilities'],
    queryFn: async () => {
      const r = await apiClient.get<{ data: DeploymentVulnerability[] }>(
        `/deployments/${deploymentId}/vulnerabilities`,
      );
      return r.data.data;
    },
    enabled: !!deploymentId,
  });
}

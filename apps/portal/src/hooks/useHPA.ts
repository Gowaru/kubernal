import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { K8sHPAStatus, K8sContainerResources } from '@kubernal/shared-types';

export function useHPA(
  namespace: string,
): UseQueryResult<{ hpa: K8sHPAStatus; resources: K8sContainerResources[] }, Error> {
  return useQuery<{ hpa: K8sHPAStatus; resources: K8sContainerResources[] }>({
    queryKey: ['k8s-hpa', namespace],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: K8sHPAStatus[] }>('/kubernetes/hpa', { params: { namespace } });
      const hpa = data.data[0];
      const resources: K8sContainerResources[] = hpa
        ? [{
            containerName: hpa.name,
            cpuUsage: hpa.cpuCurrent ? `${hpa.cpuCurrent}m` : null,
            cpuLimit: hpa.cpuTarget ? `${hpa.cpuTarget}m` : null,
            cpuRequest: '100m',
            memoryUsage: null,
            memoryLimit: null,
            memoryRequest: '128Mi',
          }]
        : [];
      return { hpa, resources };
    },
    staleTime: 3_000,
    refetchInterval: 3_000,
    enabled: !!namespace,
  });
}

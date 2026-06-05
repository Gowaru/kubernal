import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { K8sPod } from '@kubernal/shared-types';

export function useK8sPods(
  namespace: string,
  cluster?: string,
  labelSelector?: string,
): UseQueryResult<K8sPod[], Error> {
  return useQuery<K8sPod[]>({
    queryKey: ['k8s-pods', namespace, cluster, labelSelector ?? ''],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: K8sPod[] }>('/kubernetes/pods', {
        params: { namespace, cluster, labelSelector },
      });
      return data.data;
    },
    staleTime: 5_000,
    refetchInterval: 5_000,
    enabled: !!namespace,
  });
}

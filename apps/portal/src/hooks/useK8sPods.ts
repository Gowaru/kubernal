import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { K8sPod } from '@kubernal/shared-types';

export function useK8sPods(namespace: string, cluster?: string) {
  return useQuery<K8sPod[]>({
    queryKey: ['k8s-pods', namespace, cluster],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: K8sPod[] }>('/kubernetes/pods', { params: { namespace, cluster } });
      return data.data;
    },
    staleTime: 5_000,
    refetchInterval: 5_000,
    enabled: !!namespace,
  });
}

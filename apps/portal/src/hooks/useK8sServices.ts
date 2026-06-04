import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { K8sService } from '@kubernal/shared-types';

export function useK8sServices(namespace?: string, cluster?: string) {
  return useQuery<K8sService[]>({
    queryKey: ['k8s-services', namespace, cluster],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: K8sService[] }>('/kubernetes/services', { params: { namespace, cluster } });
      return data.data;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

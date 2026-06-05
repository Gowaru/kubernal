import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { K8sEvent } from '@kubernal/shared-types';

export function useK8sEvents(namespace: string, cluster?: string, limit?: number) {
  return useQuery<K8sEvent[]>({
    queryKey: ['k8s-events', namespace, cluster, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: K8sEvent[] }>('/kubernetes/events', { params: { namespace: namespace ?? '', cluster, limit } });
      return data.data;
    },
    staleTime: 8_000,
    refetchInterval: 8_000,
  });
}

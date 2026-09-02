import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { K8sEvent } from '@kubernal/shared-types';

export function useK8sEvents(namespace?: string): UseQueryResult<K8sEvent[], Error> {
  return useQuery<K8sEvent[]>({
    queryKey: ['k8s-events', namespace],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: K8sEvent[] }>('/kubernetes/events', {
        params: { namespace: namespace ?? '', limit: 100 },
      });
      return data.data;
    },
    staleTime: 30_000,
    refetchInterval: 5_000,
  });
}

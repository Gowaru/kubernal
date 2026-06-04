import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { K8sPod } from '@kubernal/shared-types';

export function useAllK8sPods() {
  return useQuery<K8sPod[]>({
    queryKey: ['k8s-all-pods'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: K8sPod[] }>('/kubernetes/pods');
      return data.data;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

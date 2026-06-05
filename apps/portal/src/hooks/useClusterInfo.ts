import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { K8sClusterContext } from '@kubernal/shared-types';

export function useClusterInfo(): UseQueryResult<K8sClusterContext, Error> {
  return useQuery<K8sClusterContext>({
    queryKey: ['k8s-cluster'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: K8sClusterContext }>('/kubernetes/cluster');
      return data.data;
    },
    staleTime: 60_000,
  });
}

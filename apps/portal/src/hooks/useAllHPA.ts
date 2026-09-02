import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { K8sHPAStatus } from '@kubernal/shared-types';

export function useAllHPA(): UseQueryResult<K8sHPAStatus[], Error> {
  return useQuery<K8sHPAStatus[]>({
    queryKey: ['k8s-all-hpa'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: K8sHPAStatus[] }>('/kubernetes/hpa/all');
      return data.data;
    },
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

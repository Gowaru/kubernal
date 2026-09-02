import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { K8sPod } from '@kubernal/shared-types';

export function useAllK8sPods(): UseQueryResult<K8sPod[], Error> {
  return useQuery<K8sPod[]>({
    queryKey: ['k8s-all-pods'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: K8sPod[] }>('/kubernetes/pods', {
        params: { namespace: '' },
      });
      return data.data;
    },
    staleTime: 30_000,
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });
}

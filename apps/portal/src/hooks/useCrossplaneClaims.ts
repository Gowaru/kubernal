import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { CrossplaneClaim } from '@kubernal/shared-types';

export function useCrossplaneClaims(namespace: string): UseQueryResult<CrossplaneClaim[], Error> {
  return useQuery<CrossplaneClaim[]>({
    queryKey: ['k8s-claims', namespace],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: CrossplaneClaim[] }>(
        '/kubernetes/crossplane/claims',
        { params: { namespace } },
      );
      return data.data;
    },
    staleTime: 15_000,
    refetchInterval: 15_000,
    enabled: !!namespace,
  });
}

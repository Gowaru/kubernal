// TODO: replace mock with API call when backend endpoints are ready
import { useQuery } from '@tanstack/react-query';
import { MOCK_CLAIMS } from '@/mocks/k8s-data';
import type { CrossplaneClaim } from '@kubernal/shared-types';

export function useCrossplaneClaims(appId: string, envId: string) {
  return useQuery<CrossplaneClaim[]>({
    queryKey: ['k8s-claims', appId, envId],
    queryFn: () => {
      const key = `${appId}-${envId}`;
      const claims = structuredClone(MOCK_CLAIMS[key] ?? []);
      if (claims.length > 0 && Math.random() < 0.1) {
        const idx = claims.findIndex(c => c.status === 'Binding');
        if (idx !== -1) {
          claims[idx] = { ...claims[idx], status: 'Ready' };
        }
      }
      return claims;
    },
    staleTime: 15_000,
    refetchInterval: 15_000,
    enabled: !!appId && !!envId,
  });
}

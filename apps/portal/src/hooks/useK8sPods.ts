// TODO: replace mock with API call when backend endpoints are ready
import { useQuery } from '@tanstack/react-query';
import { MOCK_PODS } from '@/mocks/k8s-data';
import type { K8sPod } from '@kubernal/shared-types';

export function useK8sPods(appId: string, envId: string) {
  return useQuery<K8sPod[]>({
    queryKey: ['k8s-pods', appId, envId],
    queryFn: () => {
      const filtered = MOCK_PODS.filter(
        p => p.labels['app'] === appId && p.labels['environment'] === envId,
      );
      if (filtered.length > 0 && Math.random() < 0.2) {
        const idx = Math.floor(Math.random() * filtered.length);
        const phases: K8sPod['status'][] = ['Running', 'Pending', 'Running', 'Running', 'Running'];
        filtered[idx] = {
          ...filtered[idx],
          status: phases[Math.floor(Math.random() * phases.length)],
        };
      }
      return filtered;
    },
    staleTime: 5_000,
    refetchInterval: 5_000,
    enabled: !!appId && !!envId,
  });
}

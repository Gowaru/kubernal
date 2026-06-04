// TODO: replace mock with API call when backend endpoints are ready
import { useQuery } from '@tanstack/react-query';
import { MOCK_ARGO_STATUSES } from '@/mocks/k8s-data';
import type { ArgoAppStatus } from '@kubernal/shared-types';

export function useArgoSync(appId: string, envId: string) {
  return useQuery<ArgoAppStatus>({
    queryKey: ['k8s-argo-sync', appId, envId],
    queryFn: () => {
      const key = `${appId}-${envId}`;
      return (
        MOCK_ARGO_STATUSES[key] ?? {
          sync: 'Unknown',
          health: 'Unknown',
          revision: 'unknown',
          branch: 'main',
          lastSyncAt: null,
          message: null,
        }
      );
    },
    staleTime: 30_000,
    enabled: !!appId && !!envId,
  });
}

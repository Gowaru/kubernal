import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { ArgoAppStatus } from '@kubernal/shared-types';

export function useArgoSync(appId: string, envId: string) {
  return useQuery<ArgoAppStatus>({
    queryKey: ['k8s-argo-sync', appId, envId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ArgoAppStatus }>('/kubernetes/argo', { params: { application: `${appId}-${envId}` } });
      return data.data;
    },
    staleTime: 30_000,
    enabled: !!appId && !!envId,
  });
}

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { argoApplicationName } from '@/lib/k8s-utils';
import type { ArgoAppStatus } from '@kubernal/shared-types';

/**
 * Statut Argo CD d'une application pour un type d'environnement.
 *
 * @param appName Nom de l'application (`application.name`, pas son UUID)
 * @param envType Type d'environnement (`environment.type` : dev | staging | prod)
 * @returns Le statut réel, ou `null` quand aucune Application Argo CD n'existe
 *          pour cette combinaison (Argo non configuré).
 */
export function useArgoSync(
  appName: string,
  envType: string,
): UseQueryResult<ArgoAppStatus | null, Error> {
  return useQuery<ArgoAppStatus | null>({
    queryKey: ['k8s-argo-sync', appName, envType],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ArgoAppStatus | null }>('/kubernetes/argo', {
        params: { application: argoApplicationName(appName, envType) },
      });
      return data.data;
    },
    staleTime: 30_000,
    enabled: !!appName && !!envType,
  });
}

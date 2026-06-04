// TODO: replace mock with API call when backend endpoints are ready
import { useQuery } from '@tanstack/react-query';
import { MOCK_CLUSTER } from '@/mocks/k8s-data';
import type { K8sClusterContext } from '@kubernal/shared-types';

export function useClusterInfo() {
  return useQuery<K8sClusterContext>({
    queryKey: ['k8s-cluster'],
    queryFn: () => MOCK_CLUSTER,
    staleTime: 60_000,
  });
}

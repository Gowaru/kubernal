import { useQuery } from '@tanstack/react-query';
import { MOCK_PODS } from '@/mocks/k8s-data';
import type { K8sPod } from '@kubernal/shared-types';

export function useAllK8sPods() {
  return useQuery<K8sPod[]>({
    queryKey: ['k8s-all-pods'],
    queryFn: () => MOCK_PODS,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

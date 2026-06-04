import { useQuery } from '@tanstack/react-query';
import { MOCK_K8S_SERVICES } from '@/mocks/k8s-data';
import type { K8sService } from '@kubernal/shared-types';

export function useK8sServices() {
  return useQuery<K8sService[]>({
    queryKey: ['k8s-services'],
    queryFn: () => MOCK_K8S_SERVICES,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

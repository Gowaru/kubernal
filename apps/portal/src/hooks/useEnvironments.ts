import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Environment } from '@kubernal/shared-types';

export function useEnvironments() {
  return useQuery<Environment[]>({
    queryKey: ['environments'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Environment[]; total: number }>('/environments');
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useEnvironment(id: string) {
  return useQuery<Environment>({
    queryKey: ['environments', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Environment }>(`/environments/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

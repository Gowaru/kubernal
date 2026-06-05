import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Pipeline } from '@kubernal/shared-types';

export function usePipelines(): UseQueryResult<Pipeline[], Error> {
  return useQuery<Pipeline[]>({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Pipeline[]; total: number }>('/pipelines');
      return data.data;
    },
    staleTime: 15_000,
  });
}

export function usePipeline(id: string): UseQueryResult<Pipeline, Error> {
  return useQuery<Pipeline>({
    queryKey: ['pipelines', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Pipeline }>(`/pipelines/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

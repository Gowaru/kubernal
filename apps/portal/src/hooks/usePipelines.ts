import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Pipeline } from '@kubernal/shared-types';

export function usePipeline(pipelineId: string | undefined): UseQueryResult<Pipeline, Error> {
  return useQuery<Pipeline>({
    queryKey: ['pipelines', pipelineId],
    queryFn: async () => {
      const r = await apiClient.get<{ data: Pipeline }>(`/pipelines/${pipelineId}`);
      return r.data.data;
    },
    enabled: !!pipelineId,
    refetchInterval: 3000,
  });
}

export function usePipelineSteps(pipelineId: string | undefined): UseQueryResult<unknown[], Error> {
  return useQuery<unknown[]>({
    queryKey: ['pipelines', pipelineId, 'steps'],
    queryFn: async () => {
      const r = await apiClient.get<{ data: unknown[] }>(`/pipelines/${pipelineId}/steps`);
      return r.data.data;
    },
    enabled: !!pipelineId,
    refetchInterval: 3000,
  });
}

export function usePipelinesByDeployment(deploymentId: string | undefined): UseQueryResult<Pipeline[], Error> {
  return useQuery<Pipeline[]>({
    queryKey: ['pipelines', 'by-deployment', deploymentId],
    queryFn: async () => {
      const r = await apiClient.get<{ data: Pipeline[] }>('/pipelines');
      return (r.data.data ?? []).filter((p) => p.deploymentId === deploymentId);
    },
    enabled: !!deploymentId,
    refetchInterval: 5000,
  });
}

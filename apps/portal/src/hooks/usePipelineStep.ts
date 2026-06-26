import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface PipelineStepDetails {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  action: string;
  status: string;
  params: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export function usePipelineStep(
  pipelineId: string | undefined,
  stepId: string | undefined,
): UseQueryResult<PipelineStepDetails, Error> {
  return useQuery<PipelineStepDetails>({
    queryKey: ['pipelines', pipelineId, 'steps', stepId],
    queryFn: async () => {
      const r = await apiClient.get<{ data: PipelineStepDetails }>(
        `/pipelines/${pipelineId}/steps/${stepId}`,
      );
      return r.data.data;
    },
    enabled: !!pipelineId && !!stepId,
    staleTime: 30_000,
  });
}

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface WebhookConfig {
  applicationId: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  hasSecret: boolean;
  url: string;
}

export function useWebhookConfig(
  applicationId: string | undefined,
): UseQueryResult<WebhookConfig, Error> {
  return useQuery<WebhookConfig>({
    queryKey: ['webhook-config', applicationId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: WebhookConfig }>(
        `/applications/${applicationId}/webhook`,
      );
      return data.data;
    },
    enabled: !!applicationId,
  });
}

export function useRegenerateWebhook(): UseMutationResult<
  { applicationId: string; secret: string },
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const { data } = await apiClient.post<{ data: { applicationId: string; secret: string } }>(
        `/applications/${applicationId}/webhook/regenerate`,
      );
      return data.data;
    },
    onSuccess: (_data, applicationId) => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-config', applicationId] });
    },
  });
}

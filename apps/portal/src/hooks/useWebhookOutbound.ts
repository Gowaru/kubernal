import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { WebhookConfig, WebhookDelivery } from '@kubernal/shared-types';

type CreateWebhookInput = {
  applicationId: string;
  name?: string;
  url: string;
  secret?: string;
  events?: string[];
};

type UpdateWebhookInput = {
  name?: string;
  url?: string;
  secret?: string | null;
  events?: string[];
  enabled?: boolean;
};

type ApiListResponse<T> = { data: T[] };
type ApiItemResponse<T> = { data: T };

export function useWebhookOutboundConfigs(
  applicationId: string,
): UseQueryResult<WebhookConfig[], Error> {
  return useQuery<WebhookConfig[]>({
    queryKey: ['webhook-outbound', applicationId],
    queryFn: async () => {
      const r = await apiClient.get<ApiListResponse<WebhookConfig>>(
        `/applications/${applicationId}/webhooks-outbound`,
      );
      return r.data.data;
    },
    enabled: !!applicationId,
  });
}

export function useCreateWebhookOutbound(): UseMutationResult<
  WebhookConfig,
  Error,
  CreateWebhookInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const r = await apiClient.post<ApiItemResponse<WebhookConfig>>('/webhooks-outbound', input);
      return r.data.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['webhook-outbound', result.applicationId] });
    },
  });
}

export function useUpdateWebhookOutbound(): UseMutationResult<
  WebhookConfig,
  Error,
  { id: string; data: UpdateWebhookInput }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const r = await apiClient.patch<ApiItemResponse<WebhookConfig>>(
        `/webhooks-outbound/${id}`,
        data,
      );
      return r.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-outbound'] });
    },
  });
}

export function useDeleteWebhookOutbound(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(`/webhooks-outbound/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-outbound'] });
    },
  });
}

export function useTestWebhookOutbound(): UseMutationResult<void, Error, string> {
  return useMutation({
    mutationFn: async (id) => {
      await apiClient.post(`/webhooks-outbound/${id}/test`);
    },
  });
}

export function useWebhookDeliveries(configId: string): UseQueryResult<WebhookDelivery[], Error> {
  return useQuery<WebhookDelivery[]>({
    queryKey: ['webhook-deliveries', configId],
    queryFn: async () => {
      const r = await apiClient.get<ApiListResponse<WebhookDelivery>>(
        `/webhooks-outbound/${configId}/deliveries`,
      );
      return r.data.data;
    },
    enabled: !!configId,
  });
}

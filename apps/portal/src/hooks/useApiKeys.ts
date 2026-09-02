import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { ApiKey, ApiKeyCreated } from '@kubernal/shared-types';

export function useApiKeys(): UseQueryResult<ApiKey[], Error> {
  return useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ApiKey[] }>('/api-keys');
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useCreateApiKey(): UseMutationResult<
  ApiKeyCreated,
  Error,
  { name: string; expiresInDays?: number }
> {
  const queryClient = useQueryClient();
  return useMutation<ApiKeyCreated, Error, { name: string; expiresInDays?: number }>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post<{ data: ApiKeyCreated }>('/api-keys', payload);
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

export function useDeleteApiKey(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (keyId) => {
      await apiClient.delete(`/api-keys/${keyId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

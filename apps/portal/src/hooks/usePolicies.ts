import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { SecurityPolicy } from '@kubernal/shared-types';

export function usePolicies(): UseQueryResult<SecurityPolicy[], Error> {
  return useQuery<SecurityPolicy[]>({
    queryKey: ['policies'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: SecurityPolicy[] }>('/policies');
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useTogglePolicy(): UseMutationResult<SecurityPolicy, Error, { id: string; enabled: boolean }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { data } = await apiClient.patch<{ data: SecurityPolicy }>(`/policies/${id}`, { enabled });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { SecurityPolicy } from '@kubernal/shared-types';

export function usePolicies() {
  return useQuery<SecurityPolicy[]>({
    queryKey: ['policies'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: SecurityPolicy[] }>('/policies');
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useTogglePolicy() {
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

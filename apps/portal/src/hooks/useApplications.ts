import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Application } from '@kubernal/shared-types';

export function useApplications() {
  return useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Application[]; total: number }>('/applications');
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useApplication(id: string) {
  return useQuery<Application>({
    queryKey: ['applications', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Application }>(`/applications/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (app: { name: string; description?: string; teamId: string; templateId: string }) => {
      const { data } = await apiClient.post<{ data: Application }>('/applications', app);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useDeleteApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/applications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

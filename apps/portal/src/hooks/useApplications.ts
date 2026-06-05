import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Application } from '@kubernal/shared-types';

type CreateApplicationInput = {
  name: string;
  description?: string;
  repositoryUrl?: string;
  teamId: string;
  templateId: string;
  ownerId: string;
};

export function useApplications(): UseQueryResult<Application[], Error> {
  return useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Application[]; total: number }>('/applications');
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useApplication(id: string): UseQueryResult<Application, Error> {
  return useQuery<Application>({
    queryKey: ['applications', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Application }>(`/applications/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateApplication(): UseMutationResult<Application, Error, CreateApplicationInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (app: CreateApplicationInput) => {
      const { data } = await apiClient.post<{ data: Application }>('/applications', app);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useDeleteApplication(): UseMutationResult<void, Error, string> {
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

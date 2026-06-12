import { useQuery, useMutation, useQueryClient, keepPreviousData, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Application } from '@kubernal/shared-types';

type CreateApplicationInput = {
  name: string;
  description?: string;
  repositoryUrl?: string;
  teamId: string;
  templateId: string;
  ownerId: string;
  config?: Record<string, unknown>;
};

export interface CatalogueFilters {
  search?: string;
  teamId?: string;
  status?: string;
  templateId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
}

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

export function useCatalogueApplications(filters: CatalogueFilters): UseQueryResult<PaginatedResult<Application>, Error> {
  return useQuery<PaginatedResult<Application>>({
    queryKey: ['applications', 'catalogue', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.teamId) params.set('teamId', filters.teamId);
      if (filters.status) params.set('status', filters.status);
      if (filters.templateId) params.set('templateId', filters.templateId);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
      const qs = params.toString();
      const { data } = await apiClient.get<PaginatedResult<Application>>(`/applications${qs ? `?${qs}` : ''}`);
      return data;
    },
    placeholderData: keepPreviousData,
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

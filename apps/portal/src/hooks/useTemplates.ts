import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { GoldenPathTemplate } from '@kubernal/shared-types';

export function useTemplates() {
  return useQuery<GoldenPathTemplate[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: GoldenPathTemplate[] }>('/templates');
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useTemplate(id: string) {
  return useQuery<GoldenPathTemplate>({
    queryKey: ['templates', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: GoldenPathTemplate }>(`/templates/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tmpl: { name: string; category: string; description: string; repository: string; version?: string }) => {
      const { data } = await apiClient.post<{ data: GoldenPathTemplate }>('/templates', tmpl);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

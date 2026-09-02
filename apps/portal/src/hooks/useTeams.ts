import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Team } from '@kubernal/shared-types';

export function useTeams(): UseQueryResult<Team[], Error> {
  return useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Team[] }>('/teams');
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useTeam(id: string): UseQueryResult<Team, Error> {
  return useQuery<Team>({
    queryKey: ['teams', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Team }>(`/teams/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

type CreateTeamInput = {
  name: string;
  description?: string;
  namespacePrefix: string;
  quotaCpu?: string;
  quotaMemory?: string;
};

export function useCreateTeam(): UseMutationResult<Team, Error, CreateTeamInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (team: CreateTeamInput) => {
      const { data } = await apiClient.post<{ data: Team }>('/teams', team);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { User } from '@kubernal/shared-types';

export function useUsers(): UseQueryResult<User[], Error> {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: User[]; total: number }>('/users');
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useUser(id: string): UseQueryResult<User, Error> {
  return useQuery<User>({
    queryKey: ['users', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: User }>(`/users/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

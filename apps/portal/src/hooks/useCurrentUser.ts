import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { User } from '@kubernal/shared-types';

export function useCurrentUser(): UseQueryResult<User, Error> {
  return useQuery<User>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: User[] }>('/users');
      return data.data[0];
    },
    staleTime: 60_000,
  });
}

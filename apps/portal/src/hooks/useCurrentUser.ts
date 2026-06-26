import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { User } from '@kubernal/shared-types';

export function useCurrentUser(): UseQueryResult<User, Error> {
  return useQuery<User[], Error, User>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: User[] }>('/users');
      return data.data;
    },
    staleTime: 60_000,
    select: (users) => users[0],
  });
}

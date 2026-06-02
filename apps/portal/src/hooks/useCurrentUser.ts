import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { User } from '@kubernal/shared-types';

export function useCurrentUser() {
  return useQuery<User>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: User }>('/users/1');
      return data.data;
    },
    staleTime: 60_000,
  });
}

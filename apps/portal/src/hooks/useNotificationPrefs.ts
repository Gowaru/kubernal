import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

interface NotificationPreference {
  id: string;
  userId: string;
  type: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useNotificationPrefs(): UseQueryResult<NotificationPreference[], Error> {
  return useQuery<NotificationPreference[]>({
    queryKey: ['notification-prefs'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: NotificationPreference[] }>(
        '/users/me/notification-preferences',
      );
      return data.data;
    },
  });
}

export function useUpdateNotificationPrefs(): UseMutationResult<
  NotificationPreference[],
  Error,
  Array<{ type: string; enabled: boolean }>
> {
  const queryClient = useQueryClient();
  return useMutation<NotificationPreference[], Error, Array<{ type: string; enabled: boolean }>>({
    mutationFn: async (preferences: Array<{ type: string; enabled: boolean }>) => {
      const { data } = await apiClient.patch<{ data: NotificationPreference[] }>(
        '/users/me/notification-preferences',
        { preferences },
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-prefs'] });
    },
  });
}

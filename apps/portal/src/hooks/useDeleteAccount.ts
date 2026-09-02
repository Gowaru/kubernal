import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

export function useDeleteAccount(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { logout } = useAuth();

  return useMutation({
    mutationFn: async () => {
      await apiClient.delete('/users/me');
    },
    onSuccess: async () => {
      await queryClient.clear();
      logout();
      navigate('/login');
    },
  });
}

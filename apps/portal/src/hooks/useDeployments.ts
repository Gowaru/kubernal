import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Deployment, PolicyViolation } from '@kubernal/shared-types';

export function useDeployments(): UseQueryResult<Deployment[], Error> {
  return useQuery<Deployment[]>({
    queryKey: ['deployments'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Deployment[]; total: number }>('/deployments');
      return data.data;
    },
    staleTime: 15_000,
    refetchOnMount: true,
    retry: 2,
  });
}

export function useDeployment(id: string): UseQueryResult<Deployment, Error> {
  return useQuery<Deployment>({
    queryKey: ['deployments', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Deployment }>(`/deployments/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

type CreateDeploymentInput = {
  applicationId: string;
  environmentId: string;
  version: string;
  commitSha: string;
};

export function useCreateDeployment(): UseMutationResult<Deployment, Error, CreateDeploymentInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deployment: CreateDeploymentInput) => {
      const { data } = await apiClient.post<{ data: Deployment }>('/deployments', deployment);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });
}

export function useTransitionDeployment(): UseMutationResult<Deployment, Error, { id: string; status: string }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.post<{ data: Deployment }>(`/deployments/${id}/transition`, { status });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });
}

export function useApproveDeployment(): UseMutationResult<Deployment, Error, { id: string; approvedById: string }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approvedById }: { id: string; approvedById: string }) => {
      const { data } = await apiClient.post<{ data: Deployment }>(`/deployments/${id}/approve`, { approvedById });
      return data.data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      queryClient.invalidateQueries({ queryKey: ['deployments', id] });
    },
  });
}

export function usePromoteDeployment(): UseMutationResult<Deployment, Error, { id: string; targetEnv: 'staging' | 'prod' }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, targetEnv }: { id: string; targetEnv: 'staging' | 'prod' }) => {
      const { data } = await apiClient.post<{ data: Deployment }>(`/deployments/${id}/promote`, { targetEnv });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });
}

export function useDeploymentViolations(id: string): UseQueryResult<PolicyViolation[], Error> {
  return useQuery<PolicyViolation[]>({
    queryKey: ['deployments', id, 'violations'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Deployment }>(`/deployments/${id}`);
      return (data.data.policyViolations ?? []) as PolicyViolation[];
    },
    enabled: !!id,
  });
}

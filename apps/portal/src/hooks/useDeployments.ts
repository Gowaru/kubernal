import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Deployment, PolicyViolation } from '@kubernal/shared-types';

export function useDeployments() {
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

export function useDeployment(id: string) {
  return useQuery<Deployment>({
    queryKey: ['deployments', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Deployment }>(`/deployments/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateDeployment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deployment: {
      applicationId: string;
      environmentId: string;
      version: string;
      commitSha: string;
    }) => {
      const { data } = await apiClient.post<{ data: Deployment }>('/deployments', deployment);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });
}

export function useTransitionDeployment() {
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

export function useApproveDeployment() {
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

export function usePromoteDeployment() {
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

export function useDeploymentViolations(id: string) {
  return useQuery<PolicyViolation[]>({
    queryKey: ['deployments', id, 'violations'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Deployment }>(`/deployments/${id}`);
      return (data.data.policyViolations ?? []) as PolicyViolation[];
    },
    enabled: !!id,
  });
}

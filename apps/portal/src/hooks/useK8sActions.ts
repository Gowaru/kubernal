import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface PodLogsResult {
  data: string;
  lines: string[];
  namespace: string;
  name: string;
  container: string | null;
}

export interface ScaleResult {
  kind: string;
  name: string;
  namespace: string;
  replicas: number;
}

export interface RestartResult {
  kind: string;
  name: string;
  namespace: string;
  triggeredAt: string;
}

export interface DeleteResult {
  deleted: true;
  name: string;
  namespace: string;
  serviceDeleted: boolean;
}

export interface ExecResult {
  kind: string;
  name: string;
  namespace: string;
  container: string | null;
  command: string[];
  requiresWebSocket: true;
  suggestion: string;
}

type PodLogsOptions = {
  tailLines?: number;
  container?: string;
  enabled?: boolean;
  follow?: boolean;
};

type DeleteInput = { deleteService?: boolean };
type ExecInput = { command?: string[]; container?: string };

export function useK8sPodLogs(
  podName: string,
  namespace: string,
  options: PodLogsOptions = {},
): UseQueryResult<PodLogsResult, Error> {
  const { tailLines = 200, container, enabled = true, follow = false } = options;
  return useQuery<PodLogsResult>({
    queryKey: ['k8s-pod-logs', namespace, podName, container ?? '', tailLines],
    queryFn: async () => {
      const { data } = await apiClient.get<PodLogsResult>(
        `/kubernetes/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/logs`,
        { params: { tailLines, container } },
      );
      return data;
    },
    enabled: enabled && !!podName && !!namespace,
    refetchInterval: follow ? 3_000 : false,
    staleTime: 1_000,
  });
}

export function useK8sScale(namespace: string, deploymentName: string): UseMutationResult<ScaleResult, Error, number> {
  const qc = useQueryClient();
  return useMutation<ScaleResult, Error, number>({
    mutationFn: async (replicas) => {
      const { data } = await apiClient.patch<{ data: ScaleResult }>(
        `/kubernetes/deployments/${encodeURIComponent(namespace)}/${encodeURIComponent(deploymentName)}/scale`,
        { replicas },
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['k8s-pods', namespace] });
      void qc.invalidateQueries({ queryKey: ['k8s-hpa', namespace] });
      void qc.invalidateQueries({ queryKey: ['k8s-events', namespace] });
    },
  });
}

export function useK8sRestart(namespace: string, deploymentName: string): UseMutationResult<RestartResult, Error, void> {
  const qc = useQueryClient();
  return useMutation<RestartResult, Error, void>({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ data: RestartResult }>(
        `/kubernetes/deployments/${encodeURIComponent(namespace)}/${encodeURIComponent(deploymentName)}/restart`,
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['k8s-pods', namespace] });
      void qc.invalidateQueries({ queryKey: ['k8s-events', namespace] });
      void qc.invalidateQueries({ queryKey: ['k8s-hpa', namespace] });
    },
  });
}

export function useK8sDelete(namespace: string, deploymentName: string): UseMutationResult<DeleteResult, Error, DeleteInput> {
  const qc = useQueryClient();
  return useMutation<DeleteResult, Error, DeleteInput>({
    mutationFn: async ({ deleteService = true } = {}) => {
      const { data } = await apiClient.delete<{ data: DeleteResult }>(
        `/kubernetes/deployments/${encodeURIComponent(namespace)}/${encodeURIComponent(deploymentName)}`,
        { params: { deleteService } },
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['k8s-pods', namespace] });
      void qc.invalidateQueries({ queryKey: ['k8s-services', namespace] });
      void qc.invalidateQueries({ queryKey: ['k8s-events', namespace] });
    },
  });
}

export function useK8sExec(namespace: string, podName: string): UseMutationResult<ExecResult, Error, ExecInput> {
  return useMutation<ExecResult, Error, ExecInput>({
    mutationFn: async ({ command, container } = {}) => {
      const { data } = await apiClient.post<{ data: ExecResult }>(
        `/kubernetes/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/exec`,
        { command, container },
      );
      return data.data;
    },
  });
}

type ArgoSyncResult = { success: boolean; message: string };
type ArgoAutoSyncResult = { success: boolean; message: string; autoSync: boolean };

export function useArgoSync(): UseMutationResult<ArgoSyncResult, Error, string> {
  return useMutation<ArgoSyncResult, Error, string>({
    mutationFn: async (application) => {
      const { data } = await apiClient.post<{ data: ArgoSyncResult }>('/kubernetes/argo/sync', { application });
      return data.data;
    },
  });
}

export function useArgoAutoSync(): UseMutationResult<ArgoAutoSyncResult, Error, { application: string; enabled: boolean }> {
  return useMutation<ArgoAutoSyncResult, Error, { application: string; enabled: boolean }>({
    mutationFn: async (input) => {
      const { data } = await apiClient.patch<{ data: ArgoAutoSyncResult }>('/kubernetes/argo/auto-sync', input);
      return data.data;
    },
  });
}

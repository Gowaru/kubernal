// TODO: replace mock with API call when backend endpoints are ready
import { useQuery } from '@tanstack/react-query';
import { MOCK_HPA, MOCK_RESOURCES } from '@/mocks/k8s-data';
import type { K8sHPAStatus, K8sContainerResources } from '@kubernal/shared-types';

function varyPercent(value: number, pct: number): number {
  const delta = value * pct * (Math.random() * 2 - 1);
  return Math.round((value + delta) * 100) / 100;
}

function parseResourceValue(s: string | null): { value: number; unit: string } | null {
  if (!s) return null;
  const match = s.match(/^(\d+(?:\.\d+)?)(m|Mi|Gi|Ki)$/);
  if (!match) return null;
  return { value: parseFloat(match[1]), unit: match[2] };
}

function varyResourceString(s: string | null, pct: number): string | null {
  if (!s) return null;
  const parsed = parseResourceValue(s);
  if (!parsed) return s;
  const newVal = Math.max(0, varyPercent(parsed.value, pct));
  if (parsed.unit === 'm') return `${Math.round(newVal)}m`;
  return `${Math.round(newVal)}${parsed.unit}`;
}

export function useHPA(appId: string, envId: string) {
  return useQuery<{ hpa: K8sHPAStatus; resources: K8sContainerResources[] }>({
    queryKey: ['k8s-hpa', appId, envId],
    queryFn: () => {
      const key = `${appId}-${envId}`;
      const baseHpa = MOCK_HPA[key] ?? {
        minReplicas: 1,
        maxReplicas: 5,
        currentReplicas: 1,
        desiredReplicas: 1,
        cpuTarget: null,
        cpuCurrent: null,
        memoryTarget: null,
        memoryCurrent: null,
      };
      const hpa: K8sHPAStatus = {
        ...baseHpa,
        cpuCurrent: baseHpa.cpuCurrent !== null ? varyPercent(baseHpa.cpuCurrent, 0.03) : null,
        memoryCurrent: baseHpa.memoryCurrent !== null ? varyPercent(baseHpa.memoryCurrent, 0.03) : null,
      };
      const baseResources = MOCK_RESOURCES[key] ?? [];
      const resources = baseResources.map(r => ({
        ...r,
        cpuUsage: varyResourceString(r.cpuUsage, 0.05),
        memoryUsage: varyResourceString(r.memoryUsage, 0.05),
      }));
      return { hpa, resources };
    },
    staleTime: 3_000,
    refetchInterval: 3_000,
    enabled: !!appId && !!envId,
  });
}

// TODO: replace mock with API call when backend endpoints are ready
import { useQuery } from '@tanstack/react-query';
import { MOCK_EVENTS } from '@/mocks/k8s-data';
import type { K8sEvent } from '@kubernal/shared-types';
import { useSidebar } from '@/components/layout/SidebarStore';

const REASONS = [
  'Started',
  'Killing',
  'Pulled',
  'Failed',
  'BackOff',
  'FailedScheduling',
  'SuccessfulCreate',
  'ScalingReplicaSet',
] as const;

export function useK8sEvents(namespace: string) {
  const currentNamespace = useSidebar((s) => s.currentNamespace);

  return useQuery<K8sEvent[]>({
    queryKey: ['k8s-events', namespace, currentNamespace],
    queryFn: () => {
      const events = [...MOCK_EVENTS];
      if (Math.random() < 0.15) {
        const reason = REASONS[Math.floor(Math.random() * REASONS.length)];
        events.unshift({
          id: `evt-${Math.random().toString(36).slice(2, 9)}`,
          involvedObject: `pod/${namespace}-${reason.toLowerCase()}`,
          reason,
          message: `${reason} event in ${namespace}`,
          type: reason === 'Failed' || reason === 'FailedScheduling' || reason === 'BackOff' ? 'Warning' : 'Normal',
          count: Math.floor(Math.random() * 3) + 1,
          lastTimestamp: new Date().toISOString(),
          source: 'kubelet',
        });
      }
      if (currentNamespace !== 'all') {
        return events.filter((e) => {
          if (!('namespace' in e) || !e.namespace) return true;
          return e.namespace === currentNamespace;
        });
      }
      return events;
    },
    staleTime: 8_000,
    refetchInterval: 8_000,
    enabled: !!namespace,
  });
}

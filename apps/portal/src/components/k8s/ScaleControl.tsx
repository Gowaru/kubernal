import { useState, type JSX } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useK8sScale } from '@/hooks/useK8sActions';
import type { K8sHPAStatus } from '@kubernal/shared-types';

interface ScaleControlProps {
  hpa: K8sHPAStatus | undefined;
  namespace: string;
  deploymentName: string;
  clusterReady: boolean;
}

export function ScaleControl({ hpa, namespace, deploymentName, clusterReady }: ScaleControlProps): JSX.Element {
  const scale = useK8sScale(namespace, deploymentName);
  const [pendingDelta, setPendingDelta] = useState<number | null>(null);

  if (!hpa) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 bg-secondary/50 rounded-lg border border-border">
        <span className="text-xs text-muted-foreground">Aucun HPA configuré pour ce namespace</span>
      </div>
    );
  }
  const cpuOverTarget = hpa.cpuTarget !== null && hpa.cpuCurrent !== null && hpa.cpuCurrent > hpa.cpuTarget;
  const minR = hpa.minReplicas;
  const maxR = hpa.maxReplicas;
  const current = hpa.currentReplicas;
  const isPending = scale.isPending || pendingDelta !== null;

  const handleScale = (target: number): void => {
    if (!clusterReady) {
      toast.error('Cluster K8s non branché');
      return;
    }
    if (target < minR || target > maxR) return;
    setPendingDelta(target);
    scale.mutate(target, {
      onSuccess: (result) => {
        toast.success(`Déploiement scalé à ${result.replicas} replicas`);
        setPendingDelta(null);
      },
      onError: (err) => {
        toast.error(`Échec du scale : ${err.message}`);
        setPendingDelta(null);
      },
    });
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-secondary/50 rounded-lg border border-border">
      <button
        onClick={() => handleScale(current - 1)}
        disabled={isPending || current <= minR || !clusterReady}
        title={
          !clusterReady
            ? 'Cluster K8s non branché'
            : current <= minR
              ? `Min ${minR} replicas`
              : 'Diminuer le nombre de replicas'
        }
        className={cn(
          'inline-flex items-center justify-center rounded-md border border-border h-8 w-8 transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {scale.isPending && pendingDelta !== null && pendingDelta < current ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Minus className="h-4 w-4" />
        )}
      </button>

      <div className="flex flex-col items-center gap-0.5">
        <motion.span
          key={current}
          initial={{ scale: 1.2, color: 'var(--color-k8s-succeeded)' }}
          animate={{ scale: 1, color: 'var(--color-foreground)' }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="font-mono text-2xl font-semibold tabular-nums"
        >
          {current} / {maxR}
        </motion.span>
        <span className="text-[10px] text-muted-foreground font-mono">
          min: {minR} max: {maxR}
          {hpa.cpuTarget !== null && hpa.cpuCurrent !== null && (
            <>
              {' · '}cpu: <span className={cn(cpuOverTarget && 'text-k8s-failed')}>{hpa.cpuCurrent}%</span> / {hpa.cpuTarget}%
            </>
          )}
        </span>
      </div>

      <button
        onClick={() => handleScale(current + 1)}
        disabled={isPending || current >= maxR || !clusterReady}
        title={
          !clusterReady
            ? 'Cluster K8s non branché'
            : current >= maxR
              ? `Max ${maxR} replicas`
              : 'Augmenter le nombre de replicas'
        }
        className={cn(
          'inline-flex items-center justify-center rounded-md border border-border h-8 w-8 transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {scale.isPending && pendingDelta !== null && pendingDelta > current ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

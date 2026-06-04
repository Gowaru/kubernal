import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { K8sHPAStatus } from '@kubernal/shared-types';

interface ScaleControlProps {
  hpa: K8sHPAStatus;
}

export function ScaleControl({ hpa }: ScaleControlProps) {
  const cpuOverTarget = hpa.cpuTarget !== null && hpa.cpuCurrent !== null && hpa.cpuCurrent > hpa.cpuTarget;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-secondary/50 rounded-lg border border-border">
      <button
        disabled
        title="Démo : nécessite un cluster K8s branché"
        className="inline-flex items-center justify-center rounded-md border border-border h-8 w-8 text-muted-foreground transition-colors opacity-50 cursor-not-allowed"
      >
        <Minus className="h-4 w-4" />
      </button>

      <div className="flex flex-col items-center gap-0.5">
        <motion.span
          key={hpa.desiredReplicas}
          initial={{ scale: 1.2, color: 'var(--color-k8s-succeeded)' }}
          animate={{ scale: 1, color: 'var(--color-foreground)' }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="font-mono text-2xl font-semibold tabular-nums"
        >
          {hpa.currentReplicas} / {hpa.maxReplicas}
        </motion.span>
        <span className="text-[10px] text-muted-foreground font-mono">
          min: {hpa.minReplicas} max: {hpa.maxReplicas}
          {hpa.cpuTarget !== null && hpa.cpuCurrent !== null && (
            <>
              {' · '}cpu: <span className={cn(cpuOverTarget && 'text-k8s-failed')}>{hpa.cpuCurrent}%</span> / {hpa.cpuTarget}%
            </>
          )}
        </span>
      </div>

      <button
        disabled
        title="Démo : nécessite un cluster K8s branché"
        className="inline-flex items-center justify-center rounded-md border border-border h-8 w-8 text-muted-foreground transition-colors opacity-50 cursor-not-allowed"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

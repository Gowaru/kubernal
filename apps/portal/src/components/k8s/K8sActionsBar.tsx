import { motion } from 'framer-motion';
import { RotateCcw, RefreshCw, BarChart3, Link, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArgoAppStatus } from '@kubernal/shared-types';

interface K8sActionsBarProps {
  argoStatus: ArgoAppStatus;
}

const ACTIONS = [
  { key: 'restart', label: 'Redémarrage Rolling', icon: RotateCcw },
  { key: 'sync', label: 'Sync Argo CD', icon: RefreshCw },
  { key: 'grafana', label: 'Grafana', icon: BarChart3 },
  { key: 'portforward', label: 'Port-Forward', icon: Link },
  { key: 'yaml', label: 'YAML', icon: FileCode },
] as const;

export function K8sActionsBar({
  argoStatus,
}: K8sActionsBarProps) {

  const isOutOfSync = argoStatus.sync === 'OutOfSync';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {ACTIONS.map((action, index) => {
        const Icon = action.icon;
        const isSync = action.key === 'sync';
        const isRestart = action.key === 'restart';

        return (
          <motion.button
            key={action.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            disabled
            title="Démo : nécessite un cluster K8s branché"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors opacity-50 cursor-not-allowed',
              isSync && isOutOfSync && 'border-k8s-pending/30 text-k8s-pending',
              isRestart && isOutOfSync && 'border-k8s-pending/30 text-k8s-pending',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {action.label}
          </motion.button>
        );
      })}
    </div>
  );
}

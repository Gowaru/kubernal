import { useState, type JSX } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, RefreshCw, BarChart3, Link, FileCode, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useK8sRestart, useArgoSync } from '@/hooks/useK8sActions';
import type { ArgoAppStatus } from '@kubernal/shared-types';

interface K8sActionsBarProps {
  argoStatus: ArgoAppStatus;
  namespace: string;
  deploymentName: string;
  clusterReady: boolean;
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
  namespace,
  deploymentName,
  clusterReady,
}: K8sActionsBarProps): JSX.Element {
  const restart = useK8sRestart(namespace, deploymentName);
  const argoSync = useArgoSync();
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const isOutOfSync = argoStatus.sync === 'OutOfSync';

  const handleAction = (key: string): void => {
    if (!clusterReady) {
      toast.error('Cluster K8s non branché');
      return;
    }
    if (key === 'restart') {
      setShowRestartDialog(true);
      return;
    }
    if (key === 'sync') {
      argoSync.mutate(deploymentName, {
        onSuccess: (result) => {
          toast.success(result.message);
        },
        onError: (err) => {
          toast.error(`Échec du sync : ${err.message}`);
        },
      });
      return;
    }
    if (key === 'grafana') {
      toast.warning('Grafana : à brancher');
      return;
    }
    if (key === 'portforward') {
      toast.warning('Port-Forward : à brancher');
      return;
    }
    if (key === 'yaml') {
      toast.warning('YAML viewer : à brancher');
      return;
    }
  };

  const confirmRestart = (): void => {
    setShowRestartDialog(false);
    toast.info('Déclenchement du rollout...');
    restart.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(`Rollout déclenché pour ${result.name}`);
      },
      onError: (err) => {
        toast.error(`Échec du rollout : ${err.message}`);
      },
    });
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {ACTIONS.map((action, index) => {
          const Icon = action.icon;
          const isSync = action.key === 'sync';
          const isRestart = action.key === 'restart';
          const disabled = (isRestart && restart.isPending) || (isSync && argoSync.isPending) || !clusterReady;

          return (
            <motion.button
              key={action.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              disabled={disabled}
              onClick={() => handleAction(action.key)}
              title={
                !clusterReady
                  ? 'Cluster K8s non branché'
                  : isRestart && restart.isPending
                    ? 'Rollout en cours...'
                    : isSync && argoSync.isPending
                      ? 'Sync en cours...'
                      : action.label
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors',
                disabled
                  ? 'text-muted-foreground opacity-50 cursor-not-allowed'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                isSync && isOutOfSync && 'border-k8s-pending/30 text-k8s-pending',
                isRestart && isOutOfSync && 'border-k8s-pending/30 text-k8s-pending',
              )}
            >
              {isRestart && restart.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {action.label}
            </motion.button>
          );
        })}
      </div>

      <Dialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer le redémarrage</DialogTitle>
            <DialogDescription>
              Voulez-vous déclencher un rollout restart du déploiement <strong>{deploymentName}</strong> dans le namespace <code className="font-mono text-xs">{namespace}</code> ?
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Kubernetes va recréer progressivement les pods avec une annotation{' '}
            <code className="font-mono text-xs">kubectl.kubernetes.io/restartedAt</code>.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestartDialog(false)}>
              Annuler
            </Button>
            <Button onClick={confirmRestart}>
              Confirmer le redémarrage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

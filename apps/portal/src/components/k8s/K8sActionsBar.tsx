import { useState, useCallback, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RotateCcw, RefreshCcw, BarChart3, Link, FileCode, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useK8sRestart, useK8sDelete, useArgoSync } from '@/hooks/useK8sActions';
import { useAuth } from '@/hooks/useAuth';
import type { ArgoAppStatus } from '@kubernal/shared-types';

interface K8sActionsBarProps {
  argoStatus: ArgoAppStatus;
  namespace: string;
  deploymentName: string;
  clusterReady: boolean;
  deploymentStatus?: string;
}

const ACTIONS = [
  { key: 'restart', label: 'Redémarrage Rolling', icon: RotateCcw },
  { key: 'sync', label: 'Sync Argo CD', icon: RefreshCcw },
  { key: 'grafana', label: 'Grafana', icon: BarChart3 },
  { key: 'portforward', label: 'Port-Forward', icon: Link },
  { key: 'yaml', label: 'YAML', icon: FileCode },
] as const;

export function K8sActionsBar({
  argoStatus,
  namespace,
  deploymentName,
  clusterReady,
  deploymentStatus,
}: K8sActionsBarProps): JSX.Element {
  const restart = useK8sRestart(namespace, deploymentName);
  const deleteDeployment = useK8sDelete(namespace, deploymentName);
  const argoSync = useArgoSync();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const isOutOfSync = argoStatus.sync === 'OutOfSync';

  const canDelete = hasRole('platform_engineer');
  const isDeploying =
    deploymentStatus === 'pending' ||
    deploymentStatus === 'building' ||
    deploymentStatus === 'deploying';

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
      const grafanaUrl = import.meta.env.VITE_GRAFANA_URL as string | undefined;
      if (grafanaUrl) {
        window.open(grafanaUrl, '_blank');
      } else {
        toast.error('Grafana non configuré. Ajoutez VITE_GRAFANA_URL.');
      }
      return;
    }
    if (key === 'portforward') {
      const cmd = `kubectl port-forward -n ${namespace} svc/${deploymentName} 8080:80`;
      void navigator.clipboard.writeText(cmd);
      toast.success('Commande copiée !', { description: cmd });
      return;
    }
    if (key === 'yaml') {
      const cmd = `kubectl get deployment -n ${namespace} ${deploymentName} -o yaml`;
      void navigator.clipboard.writeText(cmd);
      toast.success('Commande YAML copiée !', { description: cmd });
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

  const confirmDelete = useCallback((): void => {
    setShowDeleteDialog(false);
    setDeleteConfirmName('');
    toast.info('Suppression du déploiement K8s...');
    deleteDeployment.mutate(
      { deleteService: true },
      {
        onSuccess: () => {
          toast.success('Déploiement K8s supprimé');
          navigate('/deployments');
        },
        onError: (err) => {
          toast.error(`Échec de la suppression : ${err.message}`);
        },
      },
    );
  }, [deleteDeployment, navigate]);

  const isDeleteConfirmValid = deleteConfirmName === deploymentName;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {ACTIONS.map((action, index) => {
          const Icon = action.icon;
          const isSync = action.key === 'sync';
          const isRestart = action.key === 'restart';
          const disabled =
            (isRestart && restart.isPending) || (isSync && argoSync.isPending) || !clusterReady;

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

        {canDelete && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: ACTIONS.length * 0.05 }}
            disabled={!clusterReady || isDeploying || deleteDeployment.isPending}
            onClick={() => setShowDeleteDialog(true)}
            title={
              !clusterReady
                ? 'Cluster K8s non branché'
                : isDeploying
                  ? 'Déploiement en cours'
                  : 'Supprimer le déploiement K8s'
            }
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ml-auto',
              !clusterReady || isDeploying || deleteDeployment.isPending
                ? 'text-muted-foreground opacity-50 cursor-not-allowed border-border'
                : 'text-destructive border-destructive/30 hover:bg-destructive/10',
            )}
          >
            {deleteDeployment.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Supprimer
          </motion.button>
        )}
      </div>

      <Dialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer le redémarrage</DialogTitle>
            <DialogDescription>
              Voulez-vous déclencher un rollout restart du déploiement{' '}
              <strong>{deploymentName}</strong> dans le namespace{' '}
              <code className="font-mono text-xs">{namespace}</code> ?
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
            <Button onClick={confirmRestart}>Confirmer le redémarrage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setDeleteConfirmName('');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de supprimer le déploiement K8s{' '}
              <strong>{deploymentName}</strong> dans le namespace{' '}
              <code className="font-mono text-xs">{namespace}</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Cette action est irréversible. Le déploiement et le service K8s associé seront
              supprimés.
            </p>
            <p className="text-muted-foreground">
              Tapez <strong>{deploymentName}</strong> pour confirmer :
            </p>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={deploymentName}
              className="font-mono text-xs"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmName('');
              }}
            >
              Annuler
            </Button>
            <Button variant="destructive" disabled={!isDeleteConfirmValid} onClick={confirmDelete}>
              Supprimer le déploiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

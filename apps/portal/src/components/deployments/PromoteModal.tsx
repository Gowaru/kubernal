import { useState, useCallback, type JSX } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowUp, AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { usePromoteDeployment } from '@/hooks/useDeployments';
import type { Environment } from '@kubernal/shared-types';

interface PromoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deploymentId: string;
  version: string;
  sourceEnv: Environment;
  targetEnv: Environment;
  onPromoted?: (newDeploymentId: string) => void;
}

const envLabels: Record<string, string> = {
  dev: 'Dev',
  staging: 'Staging',
  prod: 'Production',
};

const envColors: Record<string, string> = {
  dev: 'text-env-dev',
  staging: 'text-env-staging',
  prod: 'text-env-prod',
};

export function PromoteModal({
  open,
  onOpenChange,
  deploymentId,
  version,
  sourceEnv,
  targetEnv,
  onPromoted,
}: PromoteModalProps): JSX.Element {
  const promote = usePromoteDeployment();
  const [step, setStep] = useState<'confirm' | 'progress' | 'success'>('confirm');

  const handleClose = useCallback(() => {
    setStep('confirm');
    onOpenChange(false);
  }, [onOpenChange]);

  const handlePromote = useCallback(() => {
    setStep('progress');
    promote.mutate(
      { id: deploymentId, targetEnv: targetEnv.type as 'staging' | 'prod' },
      {
        onSuccess: (newDeployment) => {
          setStep('success');
          toast.success(`Promotion vers ${envLabels[targetEnv.type]} lancée`, {
            description: `${version} → ${targetEnv.name}`,
          });
          onPromoted?.(newDeployment.id);
        },
        onError: (err) => {
          setStep('confirm');
          toast.error('Erreur lors de la promotion', {
            description: err instanceof Error ? err.message : 'Erreur inconnue',
          });
        },
      },
    );
  }, [deploymentId, targetEnv.type, targetEnv.name, version, promote, onPromoted]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowUp className="h-5 w-5" />
                Promouvoir vers {envLabels[targetEnv.type]}
              </DialogTitle>
              <DialogDescription>
                Déployer la version <span className="font-mono">{version}</span> sur l'environnement suivant.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source :</span>
                  <span className={`font-medium ${envColors[sourceEnv.type]}`}>
                    {sourceEnv.name} ({envLabels[sourceEnv.type]})
                  </span>
                </div>
                <div className="flex items-center justify-center text-muted-foreground">
                  <ArrowUp className="h-4 w-4" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cible :</span>
                  <span className={`font-medium ${envColors[targetEnv.type]}`}>
                    {targetEnv.name} ({envLabels[targetEnv.type]})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Namespace :</span>
                  <span className="font-mono text-xs">{targetEnv.namespace}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Version :</span>
                  <span className="font-mono">{version}</span>
                </div>
              </div>

              {targetEnv.requiresApproval ? (
                <div className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-status-warning mt-0.5" />
                  <div>
                    <p className="font-medium text-status-warning">Approbation requise</p>
                    <p className="text-muted-foreground mt-0.5">
                      Ce déploiement devra être approuvé manuellement avant d'être créé dans le cluster.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-status-success/30 bg-status-success/5 p-3 text-xs">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-status-success mt-0.5" />
                  <div>
                    <p className="font-medium text-status-success">Déploiement automatique</p>
                    <p className="text-muted-foreground mt-0.5">
                      Le worker IDP va créer le K8s Deployment dès la confirmation.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={handlePromote}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Promouvoir {version}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'progress' && (
          <>
            <DialogHeader>
              <DialogTitle>Promotion en cours</DialogTitle>
              <DialogDescription>Création du nouveau déploiement...</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {targetEnv.requiresApproval
                  ? 'Création du déploiement en attente d\'approbation...'
                  : 'Le worker IDP va créer le K8s Deployment...'}
              </p>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-status-success" />
                Promotion créée
              </DialogTitle>
              <DialogDescription>
                {targetEnv.requiresApproval
                  ? `Le déploiement est en attente d'approbation.`
                  : `Le déploiement a été créé et sera réconcilié par le worker.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={handleClose}>Fermer</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useCallback, useMemo, type JSX } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApplications } from '@/hooks/useApplications';
import { useCreateDeployment } from '@/hooks/useDeployments';
import { useEnvironments } from '@/hooks/useEnvironments';
import { useNextVersion, type BumpType } from '@/hooks/useNextVersion';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Rocket, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { Application } from '@kubernal/shared-types';

const postDeployOptions = [
  { id: 'tests', label: 'Exécuter les tests' },
  { id: 'autoscaling', label: 'Activer l\'auto-scaling' },
  { id: 'notify', label: 'Notification Slack' },
  { id: 'healthcheck', label: 'Health check post-déploiement' },
];

const BUMP_OPTIONS: Array<{ value: BumpType; label: string; description: string }> = [
  { value: 'auto', label: 'Auto (patch)', description: 'Incrémente le PATCH automatiquement' },
  { value: 'patch', label: 'Patch', description: 'Correction de bug (1.2.3 → 1.2.4)' },
  { value: 'minor', label: 'Minor', description: 'Nouvelle fonctionnalité (1.2.3 → 1.3.0)' },
  { value: 'major', label: 'Major', description: 'Changement incompatible (1.2.3 → 2.0.0)' },
];

interface DeploymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedApp?: Application;
  onDeploy?: (deployment: {
    applicationId: string;
    version: string;
    environment: string;
    notes: string;
    options: string[];
  }) => void;
}

export function DeploymentModal({
  open,
  onOpenChange,
  preselectedApp,
  onDeploy,
}: DeploymentModalProps): JSX.Element {
  const { data: applications } = useApplications();
  const { data: allEnvironments } = useEnvironments();
  const createDeployment = useCreateDeployment();

  const [step, setStep] = useState<'form' | 'progress' | 'success'>('form');
  const [progress, setProgress] = useState(0);

  const [appId, setAppId] = useState(preselectedApp?.id ?? '');
  const [bump, setBump] = useState<BumpType>('auto');
  const [environmentId, setEnvironmentId] = useState('');
  const [environmentSlug, setEnvironmentSlug] = useState('');
  const [notes, setNotes] = useState('');
  const [options, setOptions] = useState<string[]>([]);

  const { data: nextVersion } = useNextVersion(
    appId || undefined,
    { bump },
  );

  const version = nextVersion?.version ?? '';

  const appEnvironments = useMemo(() => {
    return (allEnvironments ?? []).filter((env) => env.applicationId === appId);
  }, [allEnvironments, appId]);

  useEffect(() => {
    if (preselectedApp) {
      setAppId(preselectedApp.id);
    }
  }, [preselectedApp]);

  useEffect(() => {
    if (!appId) {
      setEnvironmentId('');
      setEnvironmentSlug('');
    }
  }, [appId]);

  const reset = useCallback(() => {
    setStep('form');
    setProgress(0);
    setBump('auto');
    setEnvironmentId('');
    setEnvironmentSlug('');
    setNotes('');
    setOptions([]);
    if (!preselectedApp) setAppId('');
  }, [preselectedApp]);

  const handleSubmit = (): void => {
    if (!appId || !version || !environmentId) return;

    setStep('progress');
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 20, 90));
    }, 400);

    createDeployment.mutate(
      {
        applicationId: appId,
        environmentId,
        version,
        commitSha: `auto-${Date.now().toString(36)}`,
      },
      {
        onSuccess: () => {
          clearInterval(progressInterval);
          setProgress(100);
          setTimeout(() => setStep('success'), 300);

          const envLabel =
            appEnvironments.find((e) => e.id === environmentId)?.name ?? environmentSlug;
          toast.success('Déploiement lancé avec succès', {
            description: `${version} sur ${envLabel}`,
          });

          if (onDeploy) {
            onDeploy({
              applicationId: appId,
              version,
              environment: environmentSlug,
              notes,
              options,
            });
          }
        },
        onError: () => {
          clearInterval(progressInterval);
          setStep('form');
          toast.error('Erreur lors du déploiement', {
            description: 'Une erreur est survenue. Veuillez réessayer.',
          });
        },
      },
    );
  };

  const handleClose = (): void => {
    reset();
    onOpenChange(false);
  };

  const handleSuccessDone = (): void => {
    handleClose();
  };

  const isValid = appId && version && environmentId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle>Nouveau déploiement</DialogTitle>
              <DialogDescription>
                Configurez les paramètres de votre déploiement.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="app">Application</Label>
                <Select value={appId} onValueChange={setAppId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une application" />
                  </SelectTrigger>
                  <SelectContent>
                    {(applications ?? []).map((app) => (
                      <SelectItem key={app.id} value={app.id}>
                        {app.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Version</Label>
                <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                  <Sparkles className="h-4 w-4 shrink-0 text-status-info" />
                  <span className="font-mono text-sm text-foreground/90">
                    {version || (
                      <span className="italic text-muted-foreground">
                        {appId ? 'Calcul en cours…' : 'Sélectionnez une application'}
                      </span>
                    )}
                  </span>
                  {nextVersion?.isPrerelease && (
                    <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                      prerelease
                    </span>
                  )}
                </div>
                <Select value={bump} onValueChange={(v) => setBump(v as BumpType)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUMP_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">{opt.label}</span>
                          <span className="text-[10px] text-muted-foreground">{opt.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="env">Environnement</Label>
                <Select
                  value={environmentId}
                  onValueChange={(value) => {
                    setEnvironmentId(value);
                    const found = appEnvironments.find((e) => e.id === value);
                    setEnvironmentSlug(found?.type ?? '');
                  }}
                  disabled={!appId || appEnvironments.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !appId
                        ? "Sélectionnez d'abord une application"
                        : appEnvironments.length === 0
                          ? "Aucun environnement — créez l'application d'abord"
                          : 'Sélectionner un environnement'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {appEnvironments.map((env) => (
                      <SelectItem key={env.id} value={env.id}>
                        {env.name} ({env.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes de release</Label>
                <textarea
                  id="notes"
                  className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Décrivez les changements de cette version..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Actions post-déploiement</Label>
                <div className="grid grid-cols-2 gap-2">
                  {postDeployOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
                    >
                      <Checkbox
                        checked={options.includes(opt.id)}
                        onCheckedChange={(checked) => {
                          setOptions(
                            checked
                              ? [...options, opt.id]
                              : options.filter((o) => o !== opt.id),
                          );
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={!isValid}>
                <Rocket className="mr-2 h-4 w-4" />
                Lancer le déploiement
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'progress' && (
          <>
            <DialogHeader>
              <DialogTitle>Déploiement en cours</DialogTitle>
              <DialogDescription>
                Veuillez patienter pendant le déploiement...
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {progress < 40 && 'Préparation de l\'environnement...'}
                {progress >= 40 && progress < 70 && 'Déploiement des artefacts...'}
                {progress >= 70 && progress < 90 && 'Exécution des health checks...'}
                {progress >= 90 && 'Finalisation...'}
              </p>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle>Déploiement réussi !</DialogTitle>
              <DialogDescription>
                Le déploiement a été effectué avec succès.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-status-success" />
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                L'application a été déployée sur l'environnement{' '}
                <strong className="text-foreground">
                  {appEnvironments.find((e) => e.id === environmentId)?.name ?? environmentSlug}
                </strong>{' '}
                avec la version <strong className="text-foreground">{version}</strong>.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleSuccessDone}>
                Terminé
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

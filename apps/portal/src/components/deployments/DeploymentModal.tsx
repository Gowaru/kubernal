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
import {
  Loader2,
  Rocket,
  CheckCircle2,
  Sparkles,
  Box,
  Globe,
  GitCommit,
  Puzzle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Application } from '@kubernal/shared-types';

const postDeployOptions = [
  { id: 'tests', label: 'Exécuter les tests' },
  { id: 'autoscaling', label: "Activer l'auto-scaling" },
  { id: 'notify', label: 'Notification Slack' },
  { id: 'healthcheck', label: 'Health check post-déploiement' },
];

const BUMP_OPTIONS: Array<{ value: BumpType; label: string }> = [
  { value: 'auto', label: 'Auto (patch)' },
  { value: 'patch', label: 'Patch' },
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
];

function SectionHeading({ icon: Icon, label }: { icon: typeof Box; label: string }): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );
}

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

  const { data: nextVersion } = useNextVersion(appId || undefined, { bump });

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
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                  <Rocket className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Nouveau déploiement</DialogTitle>
                  <DialogDescription>
                    Configurez les paramètres avant de lancer le déploiement
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 py-1">
              <div className="space-y-2">
                <SectionHeading icon={Box} label="Application" />
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
                <SectionHeading icon={GitCommit} label="Version" />
                {appId ? (
                  <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Sparkles className="h-4 w-4 shrink-0 text-status-info" />
                        <span className="truncate font-mono text-sm text-foreground tracking-tight">
                          {nextVersion ? version : 'Calcul en cours…'}
                        </span>
                        {nextVersion?.isPrerelease && (
                          <span className="shrink-0 rounded-full bg-status-warning/10 px-2 py-0.5 text-[10px] font-semibold text-status-warning">
                            prerelease
                          </span>
                        )}
                      </div>
                      <Select value={bump} onValueChange={(v) => setBump(v as BumpType)}>
                        <SelectTrigger className="h-7 w-[130px] shrink-0 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          {BUMP_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <span className="text-xs">{opt.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/60 px-4 py-3">
                    <p className="text-xs text-muted-foreground/60">
                      Sélectionnez une application pour calculer la prochaine version
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <SectionHeading icon={Globe} label="Destination" />
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
                    <SelectValue
                      placeholder={
                        !appId
                          ? "Sélectionnez d'abord une application"
                          : appEnvironments.length === 0
                            ? "Aucun environnement — créez l'application d'abord"
                            : 'Sélectionner un environnement'
                      }
                    />
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
                <SectionHeading icon={Puzzle} label="Post-deploy" />
                <div className="grid grid-cols-2 gap-1.5">
                  {postDeployOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-2 text-xs cursor-pointer hover:bg-accent transition-colors has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/5"
                    >
                      <Checkbox
                        checked={options.includes(opt.id)}
                        onCheckedChange={(checked) => {
                          setOptions(
                            checked ? [...options, opt.id] : options.filter((o) => o !== opt.id),
                          );
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <SectionHeading icon={Puzzle} label="Notes" />
                <textarea
                  className="flex min-h-[72px] w-full rounded-md border border-border/60 bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  placeholder="Décrivez les changements de cette version…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!isValid || createDeployment.isPending}
              >
                {createDeployment.isPending && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                <Rocket className="mr-1.5 h-3.5 w-3.5" />
                Lancer le déploiement
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'progress' && (
          <>
            <DialogHeader>
              <DialogTitle>Déploiement en cours</DialogTitle>
              <DialogDescription>Veuillez patienter pendant le déploiement…</DialogDescription>
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
                {progress < 40 && "Préparation de l'environnement…"}
                {progress >= 40 && progress < 70 && 'Déploiement des artefacts…'}
                {progress >= 70 && progress < 90 && 'Exécution des health checks…'}
                {progress >= 90 && 'Finalisation…'}
              </p>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle>Déploiement réussi</DialogTitle>
              <DialogDescription>Le déploiement a été effectué avec succès.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-success/10">
                <CheckCircle2 className="h-8 w-8 text-status-success" />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                L'application a été déployée sur{' '}
                <strong className="text-foreground">
                  {appEnvironments.find((e) => e.id === environmentId)?.name ?? environmentSlug}
                </strong>{' '}
                avec la version <strong className="font-mono text-foreground">{version}</strong>.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleSuccessDone}>Terminé</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

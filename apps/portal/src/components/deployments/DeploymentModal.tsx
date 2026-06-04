import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApplications } from '@/hooks/useApplications';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Rocket, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Application } from '@kubernal/shared-types';

const environments = [
  { value: 'dev', label: 'Development' },
  { value: 'staging', label: 'Staging' },
  { value: 'prod', label: 'Production' },
];

const postDeployOptions = [
  { id: 'tests', label: 'Exécuter les tests' },
  { id: 'autoscaling', label: 'Activer l\'auto-scaling' },
  { id: 'notify', label: 'Notification Slack' },
  { id: 'healthcheck', label: 'Health check post-déploiement' },
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
}: DeploymentModalProps) {
  const { data: applications } = useApplications();
  const [step, setStep] = useState<'form' | 'progress' | 'success'>('form');
  const [progress, setProgress] = useState(0);

  const [appId, setAppId] = useState(preselectedApp?.id ?? '');
  const [version, setVersion] = useState('');
  const [environment, setEnvironment] = useState('');
  const [notes, setNotes] = useState('');
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    if (preselectedApp) {
      setAppId(preselectedApp.id);
    }
  }, [preselectedApp]);

  const reset = useCallback(() => {
    setStep('form');
    setProgress(0);
    setVersion('');
    setEnvironment('');
    setNotes('');
    setOptions([]);
    if (!preselectedApp) setAppId('');
  }, [preselectedApp]);

  const handleSubmit = () => {
    setStep('progress');
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(p + Math.random() * 25, 100);
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => setStep('success'), 300);
        }
        return next;
      });
    }, 400);

    if (onDeploy) {
      onDeploy({ applicationId: appId, version, environment, notes, options });
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleSuccessDone = () => {
    const environmentLabel =
      environments.find((e) => e.value === environment)?.label ?? environment;
    toast.success('Déploiement lancé avec succès', {
      description: `${version} sur ${environmentLabel}`,
    });
    handleClose();
  };

  const isValid = appId && version && environment;

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
                <Label htmlFor="version">Version (tag git / image Docker)</Label>
                <Input
                  id="version"
                  placeholder="v1.2.3 ou mon-app:latest"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="env">Environnement</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un environnement" />
                  </SelectTrigger>
                  <SelectContent>
                    {environments.map((env) => (
                      <SelectItem key={env.value} value={env.value}>
                        {env.label}
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
              <CheckCircle2 className="h-16 w-16 text-emerald-400" />
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                L'application a été déployée sur l'environnement{' '}
                <strong className="text-foreground">
                  {environments.find((e) => e.value === environment)?.label}
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

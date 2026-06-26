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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateTeam } from '@/hooks/useTeams';
import { Loader2, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const formSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  namespacePrefix: z.string().min(1, 'Le préfixe namespace est requis'),
  quotaCpu: z.string().optional(),
  quotaMemory: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTeamModal({ open, onOpenChange }: CreateTeamModalProps): JSX.Element {
  const createTeam = useCreateTeam();

  const [step, setStep] = useState<'step1' | 'step2' | 'progress' | 'success'>('step1');
  const [progress, setProgress] = useState(0);
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    namespacePrefix: '',
    quotaCpu: '4',
    quotaMemory: '8Gi',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const reset = useCallback(() => {
    setStep('step1');
    setProgress(0);
    setForm({ name: '', description: '', namespacePrefix: '', quotaCpu: '4', quotaMemory: '8Gi' });
    setErrors({});
  }, []);

  const handleClose = (): void => {
    reset();
    onOpenChange(false);
  };

  const validateStep1 = (): boolean => {
    const result = formSchema.pick({ name: true, description: true, namespacePrefix: true }).safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FormData, string>> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as keyof FormData] = issue.message;
      }
      setErrors(fieldErrors);
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    const result = formSchema.pick({ quotaCpu: true, quotaMemory: true }).safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FormData, string>> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as keyof FormData] = issue.message;
      }
      setErrors(fieldErrors);
      return false;
    }
    return true;
  };

  const handleNext = (): void => {
    if (step === 'step1' && validateStep1()) {
      setStep('step2');
    } else if (step === 'step2' && validateStep2()) {
      handleSubmit();
    }
  };

  const handleBack = (): void => {
    if (step === 'step2') setStep('step1');
  };

  const handleSubmit = async (): Promise<void> => {
    setStep('progress');
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(p + Math.random() * 30, 100);
        if (next >= 100) {
          clearInterval(interval);
        }
        return next;
      });
    }, 300);

    try {
      await createTeam.mutateAsync({
        name: form.name,
        description: form.description || undefined,
        namespacePrefix: form.namespacePrefix,
        quotaCpu: form.quotaCpu || undefined,
        quotaMemory: form.quotaMemory || undefined,
      });
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => setStep('success'), 300);
    } catch {
      clearInterval(interval);
      toast.error("Erreur lors de la création de l'équipe");
      setStep('step1');
    }
  };

  const handleSuccessDone = (): void => {
    toast.success('Équipe créée avec succès', {
      description: form.name,
    });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {step === 'step1' && (
          <>
            <DialogHeader>
              <DialogTitle>Nouvelle équipe</DialogTitle>
              <DialogDescription>
                Étape 1 sur 2 — Identité de l'équipe
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  placeholder="Équipe innovation"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                />
                {errors.name && (
                  <p className="text-xs text-status-error">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Description optionnelle"
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                />
                {errors.description && (
                  <p className="text-xs text-status-error">{errors.description}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="namespacePrefix">Préfixe namespace</Label>
                <Input
                  id="namespacePrefix"
                  placeholder="team-innovation"
                  value={form.namespacePrefix}
                  onChange={(e) => setField('namespacePrefix', e.target.value)}
                  required
                />
                {errors.namespacePrefix && (
                  <p className="text-xs text-status-error">{errors.namespacePrefix}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={handleNext}>
                Suivant
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'step2' && (
          <>
            <DialogHeader>
              <DialogTitle>Nouvelle équipe</DialogTitle>
              <DialogDescription>
                Étape 2 sur 2 — Ressources et quotas
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quotaCpu">Quota CPU</Label>
                  <Input
                    id="quotaCpu"
                    placeholder="4"
                    value={form.quotaCpu}
                    onChange={(e) => setField('quotaCpu', e.target.value)}
                  />
                  {errors.quotaCpu && (
                    <p className="text-xs text-status-error">{errors.quotaCpu}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quotaMemory">Quota mémoire</Label>
                  <Input
                    id="quotaMemory"
                    placeholder="8Gi"
                    value={form.quotaMemory}
                    onChange={(e) => setField('quotaMemory', e.target.value)}
                  />
                  {errors.quotaMemory && (
                    <p className="text-xs text-status-error">{errors.quotaMemory}</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Récapitulatif</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Nom : <span className="text-foreground">{form.name}</span></p>
                  {form.description && (
                    <p>Description : <span className="text-foreground">{form.description}</span></p>
                  )}
                  <p>Namespace : <span className="text-foreground">{form.namespacePrefix}</span></p>
                  <p>CPU : <span className="text-foreground">{form.quotaCpu || '—'}</span></p>
                  <p>Mémoire : <span className="text-foreground">{form.quotaMemory || '—'}</span></p>
                </div>
              </div>
            </div>

            <DialogFooter className="justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <Button onClick={handleNext} disabled={createTeam.isPending}>
                {createTeam.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Créer l'équipe
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'progress' && (
          <>
            <DialogHeader>
              <DialogTitle>Création en cours</DialogTitle>
              <DialogDescription>
                Veuillez patienter pendant la création de l'équipe...
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
                {progress < 40 && "Préparation de l'équipe..."}
                {progress >= 40 && progress < 70 && 'Configuration des quotas...'}
                {progress >= 70 && progress < 90 && 'Création du namespace...'}
                {progress >= 90 && 'Finalisation...'}
              </p>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle>Équipe créée !</DialogTitle>
              <DialogDescription>
                L'équipe a été créée avec succès.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-status-success" />
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                L'équipe{' '}
                <strong className="text-foreground">{form.name}</strong>{' '}
                a été créée avec le namespace{' '}
                <strong className="text-foreground">{form.namespacePrefix}</strong>.
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

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateApplication } from '@/hooks/useApplications';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeams } from '@/hooks/useTeams';
import { useTemplates } from '@/hooks/useTemplates';
import { Loader2, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const formSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  teamId: z.string().min(1, "L'équipe est requise"),
  templateId: z.string().min(1, 'Le template est requis'),
});

type FormData = z.infer<typeof formSchema>;

interface CreateApplicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateApplicationModal({ open, onOpenChange }: CreateApplicationModalProps): JSX.Element {
  const { data: currentUser } = useCurrentUser();
  const { data: teams } = useTeams();
  const { data: templates } = useTemplates();
  const createApplication = useCreateApplication();

  const [step, setStep] = useState<'step1' | 'step2' | 'progress' | 'success'>('step1');
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    teamId: '',
    templateId: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const reset = useCallback(() => {
    setStep('step1');
    setForm({ name: '', description: '', teamId: '', templateId: '' });
    setErrors({});
  }, []);

  const handleClose = (): void => {
    reset();
    onOpenChange(false);
  };

  const validateStep1 = (): boolean => {
    const result = formSchema.pick({ name: true, description: true }).safeParse(form);
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
    const result = formSchema.pick({ teamId: true, templateId: true }).safeParse(form);
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

    try {
      await createApplication.mutateAsync({
        name: form.name,
        description: form.description || undefined,
        teamId: form.teamId,
        templateId: form.templateId,
        ownerId: currentUser?.id ?? '',
      });
      setStep('success');
    } catch {
      toast.error("Erreur lors de la création de l'application");
      setStep('step1');
    }
  };

  const handleSuccessDone = (): void => {
    toast.success('Application créée avec succès', {
      description: form.name,
    });
    handleClose();
  };

  const selectedTeam = teams?.find((t) => t.id === form.teamId);
  const selectedTemplate = templates?.find((t) => t.id === form.templateId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {step === 'step1' && (
          <>
            <DialogHeader>
              <DialogTitle>Nouvelle application</DialogTitle>
              <DialogDescription>
                Étape 1 sur 2 — Informations générales
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  placeholder="Mon application"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                />
                {errors.name && (
                  <p className="text-xs text-red-400">{errors.name}</p>
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
                  <p className="text-xs text-red-400">{errors.description}</p>
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
              <DialogTitle>Nouvelle application</DialogTitle>
              <DialogDescription>
                Étape 2 sur 2 — Équipe et template
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="teamId">Équipe</Label>
                <Select value={form.teamId} onValueChange={(v) => setField('teamId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une équipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {(teams ?? []).map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.teamId && (
                  <p className="text-xs text-red-400">{errors.teamId}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateId">Template</Label>
                <Select value={form.templateId} onValueChange={(v) => setField('templateId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un template" />
                  </SelectTrigger>
                  <SelectContent>
                    {(templates ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.templateId && (
                  <p className="text-xs text-red-400">{errors.templateId}</p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Récapitulatif</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Nom : <span className="text-foreground">{form.name}</span></p>
                  {form.description && (
                    <p>Description : <span className="text-foreground">{form.description}</span></p>
                  )}
                  <p>Équipe : <span className="text-foreground">{selectedTeam?.name ?? form.teamId}</span></p>
                  <p>Template : <span className="text-foreground">{selectedTemplate?.name ?? form.templateId}</span></p>
                </div>
              </div>
            </div>

            <DialogFooter className="justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <Button onClick={handleNext} disabled={createApplication.isPending}>
                {createApplication.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Créer l'application
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'progress' && (
          <>
            <DialogHeader>
              <DialogTitle>Création en cours</DialogTitle>
              <DialogDescription>
                Veuillez patienter pendant la création de l'application...
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Création de l'application et provisionnement des environnements...
              </p>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle>Application créée !</DialogTitle>
              <DialogDescription>
                L'application a été créée avec succès.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-emerald-400" />
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                L'application{' '}
                <strong className="text-foreground">{form.name}</strong>{' '}
                a été créée dans l'équipe{' '}
                <strong className="text-foreground">{selectedTeam?.name}</strong>
                .
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

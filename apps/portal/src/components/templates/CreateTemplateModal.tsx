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
import { useCreateTemplate } from '@/hooks/useTemplates';
import { Loader2, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const categories = [
  { value: 'backend', label: 'Backend' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'fullstack', label: 'Fullstack' },
  { value: 'library', label: 'Library' },
  { value: 'function', label: 'Function' },
];

const formSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  category: z.string().min(1, 'La catégorie est requise'),
  description: z.string().min(1, 'La description est requise'),
  repository: z.string().url('URL invalide').min(1, "L'URL du dépôt est requise"),
  version: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTemplateModal({ open, onOpenChange }: CreateTemplateModalProps): JSX.Element {
  const createTemplate = useCreateTemplate();

  const [step, setStep] = useState<'step1' | 'step2' | 'progress' | 'success'>('step1');
  const [progress, setProgress] = useState(0);
  const [form, setForm] = useState<FormData>({
    name: '',
    category: '',
    description: '',
    repository: '',
    version: '1.0.0',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const reset = useCallback(() => {
    setStep('step1');
    setProgress(0);
    setForm({ name: '', category: '', description: '', repository: '', version: '1.0.0' });
    setErrors({});
  }, []);

  const handleClose = (): void => {
    reset();
    onOpenChange(false);
  };

  const validateStep1 = (): boolean => {
    const result = formSchema.pick({ name: true, category: true, description: true }).safeParse(form);
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
    const result = formSchema.pick({ repository: true, version: true }).safeParse(form);
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
      await createTemplate.mutateAsync({
        name: form.name,
        category: form.category,
        description: form.description,
        repository: form.repository,
        version: form.version || undefined,
      });
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => setStep('success'), 300);
    } catch {
      clearInterval(interval);
      toast.error('Erreur lors de la création du template');
      setStep('step1');
    }
  };

  const handleSuccessDone = (): void => {
    toast.success('Template créé avec succès', {
      description: form.name,
    });
    handleClose();
  };

  const selectedCategory = categories.find((c) => c.value === form.category);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {step === 'step1' && (
          <>
            <DialogHeader>
              <DialogTitle>Nouveau template</DialogTitle>
              <DialogDescription>
                Étape 1 sur 2 — Métadonnées du template
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  placeholder="Node.js Backend"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                />
                {errors.name && (
                  <p className="text-xs text-status-error">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setField('category', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-xs text-status-error">{errors.category}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Template Node.js avec Express et Prisma"
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  required
                />
                {errors.description && (
                  <p className="text-xs text-status-error">{errors.description}</p>
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
              <DialogTitle>Nouveau template</DialogTitle>
              <DialogDescription>
                Étape 2 sur 2 — Configuration du dépôt
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="repository">URL du dépôt</Label>
                <Input
                  id="repository"
                  type="url"
                  placeholder="https://github.com/org/template-nodejs"
                  value={form.repository}
                  onChange={(e) => setField('repository', e.target.value)}
                  required
                />
                {errors.repository && (
                  <p className="text-xs text-status-error">{errors.repository}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  placeholder="1.0.0"
                  value={form.version}
                  onChange={(e) => setField('version', e.target.value)}
                />
                {errors.version && (
                  <p className="text-xs text-status-error">{errors.version}</p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Récapitulatif</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Nom : <span className="text-foreground">{form.name}</span></p>
                  <p>Catégorie : <span className="text-foreground">{selectedCategory?.label ?? form.category}</span></p>
                  <p>Description : <span className="text-foreground">{form.description}</span></p>
                  <p>Dépôt : <span className="text-foreground">{form.repository}</span></p>
                  <p>Version : <span className="text-foreground">{form.version || '—'}</span></p>
                </div>
              </div>
            </div>

            <DialogFooter className="justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <Button onClick={handleNext} disabled={createTemplate.isPending}>
                {createTemplate.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Créer le template
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'progress' && (
          <>
            <DialogHeader>
              <DialogTitle>Création en cours</DialogTitle>
              <DialogDescription>
                Veuillez patienter pendant la création du template...
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
                {progress < 40 && 'Préparation du template...'}
                {progress >= 40 && progress < 70 && 'Configuration du dépôt...'}
                {progress >= 70 && progress < 90 && 'Validation des métadonnées...'}
                {progress >= 90 && 'Finalisation...'}
              </p>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle>Template créé !</DialogTitle>
              <DialogDescription>
                Le template a été créé avec succès.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-status-success" />
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                Le template{' '}
                <strong className="text-foreground">{form.name}</strong>{' '}
                a été créé dans la catégorie{' '}
                <strong className="text-foreground">{selectedCategory?.label}</strong>.
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

import { useState, useEffect, useCallback, type JSX } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { useTeams } from '@/hooks/useTeams';
import { useTemplates } from '@/hooks/useTemplates';
import { Loader2, CheckCircle2, ChevronLeft, ChevronRight, Github, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { detectProvider, isValidRepoUrl, REPO_URL_REGEX } from '@/lib/repo-utils';

interface ParamDefinition {
  type: 'string' | 'number' | 'boolean';
  label?: string;
  default?: unknown;
  required?: boolean;
  enum?: string[];
  disabled?: boolean;
}

type TemplateParameters = Record<string, ParamDefinition>;

const APP_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/;

const formSchema = z.object({
  name: z
    .string()
    .min(1, 'Le nom est requis')
    .max(52, 'Maximum 52 caractères')
    .regex(APP_NAME_REGEX, 'Lettres, chiffres et tirets uniquement (pas d\u0027espaces ni caractères spéciaux)'),
  description: z.string().optional(),
  repositoryUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || REPO_URL_REGEX.test(v),
      'URL invalide (GitHub, GitLab ou Bitbucket)',
    ),
  teamId: z.string().min(1, "L'équipe est requise"),
  templateId: z.string().min(1, 'Le template est requis'),
});

type FormData = z.infer<typeof formSchema>;
type Step = 'step1' | 'step2' | 'step3' | 'progress' | 'success';

interface CreateApplicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getDefaultConfig(template: { parameters?: unknown } | undefined): Record<string, unknown> {
  if (!template?.parameters || typeof template.parameters !== 'object') return {};
  const params = template.parameters as TemplateParameters;
  const config: Record<string, unknown> = {};
  for (const [key, param] of Object.entries(params)) {
    if (param && typeof param === 'object' && 'default' in param && param.default !== undefined) {
      config[key] = param.default;
    }
  }
  return config;
}

function getParamDefs(template: { parameters?: unknown } | undefined): TemplateParameters {
  if (!template?.parameters || typeof template.parameters !== 'object') return {};
  return template.parameters as TemplateParameters;
}

function hasParams(template: { parameters?: unknown } | undefined): boolean {
  return Object.keys(getParamDefs(template)).length > 0;
}

export function CreateApplicationModal({ open, onOpenChange }: CreateApplicationModalProps): JSX.Element {
  const { user: currentUser } = useAuth();
  const { data: teams } = useTeams();
  const { data: templates } = useTemplates();
  const createApplication = useCreateApplication();

  const [step, setStep] = useState<Step>('step1');
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    repositoryUrl: '',
    teamId: '',
    templateId: '',
  });
  const [formConfig, setFormConfig] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | string, string>>>({});

  const selectedTemplate = templates?.find((t) => t.id === form.templateId);

  useEffect(() => {
    setFormConfig(getDefaultConfig(selectedTemplate));
  }, [form.templateId, templates]);

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const setConfigField = (key: string, value: unknown): void => {
    setFormConfig((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const reset = useCallback(() => {
    setStep('step1');
    setForm({ name: '', description: '', repositoryUrl: '', teamId: '', templateId: '' });
    setFormConfig({});
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

  const validateStep3 = (): boolean => {
    const paramDefs = getParamDefs(selectedTemplate);
    const newErrors: Record<string, string> = {};
    for (const [key, def] of Object.entries(paramDefs)) {
      if (def.required && (formConfig[key] === undefined || formConfig[key] === '' || formConfig[key] === null)) {
        newErrors[key] = `Le champ "${def.label || key}" est requis`;
      }
    }
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = (): void => {
    if (step === 'step1' && validateStep1()) {
      setStep('step2');
    } else if (step === 'step2' && validateStep2()) {
      if (hasParams(selectedTemplate)) {
        setStep('step3');
      } else {
        handleSubmit();
      }
    } else if (step === 'step3' && validateStep3()) {
      handleSubmit();
    }
  };

  const handleBack = (): void => {
    if (step === 'step2') setStep('step1');
    else if (step === 'step3') setStep('step2');
  };

  const handleSubmit = async (): Promise<void> => {
    setStep('progress');
    try {
      await createApplication.mutateAsync({
        name: form.name,
        description: form.description || undefined,
        repositoryUrl: form.repositoryUrl || undefined,
        teamId: form.teamId,
        templateId: form.templateId,
        ownerId: currentUser?.id ?? '',
        config: Object.keys(formConfig).length > 0 ? formConfig : undefined,
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
  const anyTemplateHasParams = templates?.some((t) => {
    if (!t.parameters || typeof t.parameters !== 'object') return false;
    return Object.keys(t.parameters as TemplateParameters).length > 0;
  }) ?? false;
  const totalSteps = anyTemplateHasParams ? 3 : 2;

  const paramDefs = getParamDefs(selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {step === 'step1' && (
          <>
            <DialogHeader>
              <DialogTitle>Nouvelle application</DialogTitle>
              <DialogDescription>
                Étape 1 sur {totalSteps} — Informations générales
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  placeholder="ex: payment-api"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                  maxLength={52}
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
                <Label htmlFor="repositoryUrl" className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5" />
                  Dépôt Git
                  <span className="text-xs text-muted-foreground font-normal">(optionnel)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="repositoryUrl"
                    placeholder="https://github.com/owner/repo.git"
                    value={form.repositoryUrl}
                    onChange={(e) => setField('repositoryUrl', e.target.value)}
                    className="pr-10"
                  />
                  {form.repositoryUrl && detectProvider(form.repositoryUrl) === 'github' && (
                    <Github className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {form.repositoryUrl && isValidRepoUrl(form.repositoryUrl) && (
                  <p className="text-xs text-status-success">
                    {detectProvider(form.repositoryUrl) === 'github' && 'GitHub détecté'}
                    {detectProvider(form.repositoryUrl) === 'gitlab' && 'GitLab détecté'}
                    {detectProvider(form.repositoryUrl) === 'bitbucket' && 'Bitbucket détecté'}
                  </p>
                )}
                {errors.repositoryUrl && (
                  <p className="text-xs text-status-error">{errors.repositoryUrl}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Lien direct vers les commits et les diffs. Si vide, le dépôt du template sera utilisé.
                </p>
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
                Étape 2 sur {totalSteps} — Équipe et template
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
                  <p className="text-xs text-status-error">{errors.teamId}</p>
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
                  <p className="text-xs text-status-error">{errors.templateId}</p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Récapitulatif</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Nom : <span className="text-foreground">{form.name}</span></p>
                  {form.description && (
                    <p>Description : <span className="text-foreground">{form.description}</span></p>
                  )}
                  {form.repositoryUrl && (
                    <p>Dépôt : <span className="text-foreground font-mono text-xs">{form.repositoryUrl}</span></p>
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
              <Button onClick={handleNext}>
                {hasParams(selectedTemplate) ? (
                  <>
                    Suivant
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  'Créer l\'application'
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'step3' && (
          <>
            <DialogHeader>
              <DialogTitle>Nouvelle application</DialogTitle>
              <DialogDescription>
                Étape 3 sur 3 — Configuration du template
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {Object.entries(paramDefs).map(([key, def]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`param-${key}`}>
                    {def.label || key}
                    {def.required && <span className="text-status-error ml-1">*</span>}
                  </Label>

                  {def.enum ? (
                    <Select
                      value={String(formConfig[key] ?? def.default ?? '')}
                      onValueChange={(v) => setConfigField(key, v)}
                    >
                      <SelectTrigger id={`param-${key}`}>
                        <SelectValue placeholder={`Choisir ${def.label || key}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {def.enum.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : def.type === 'boolean' ? (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        id={`param-${key}`}
                        type="checkbox"
                        checked={formConfig[key] === true}
                        onChange={(e) => setConfigField(key, e.target.checked)}
                        className="h-4 w-4 rounded border-border bg-muted text-primary focus:ring-primary"
                      />
                      <Label htmlFor={`param-${key}`} className="text-sm text-muted-foreground cursor-pointer">
                        Activer
                      </Label>
                    </div>
                  ) : (
                    <Input
                      id={`param-${key}`}
                      type={def.type === 'number' ? 'number' : 'text'}
                      placeholder={def.label || key}
                      value={String(formConfig[key] ?? def.default ?? '')}
                      onChange={(e) =>
                        setConfigField(
                          key,
                          def.type === 'number' ? (e.target.value ? Number(e.target.value) : '') : e.target.value,
                        )
                      }
                      disabled={def.disabled}
                    />
                  )}
                  {errors[key] && (
                    <p className="text-xs text-status-error">{errors[key]}</p>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter className="justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <Button onClick={handleNext}>
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
              <CheckCircle2 className="h-16 w-16 text-status-success" />
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

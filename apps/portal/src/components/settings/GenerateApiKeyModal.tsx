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
import { Key, Copy, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { ApiKeyCreated } from '@kubernal/shared-types';
import { useCreateApiKey } from '@/hooks/useApiKeys';

interface GenerateApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeyGenerated: (key: ApiKeyCreated) => void;
}

const expiryOptions = [
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
  { value: '365', label: '1 an' },
  { value: 'never', label: 'Jamais' },
];

function formatExpires(expiry: string): string {
  if (expiry === 'never') return 'Jamais';
  return new Date(Date.now() + parseInt(expiry, 10) * 24 * 60 * 60 * 1000).toLocaleDateString(
    'fr-FR',
  );
}

export function GenerateApiKeyModal({
  open,
  onOpenChange,
  onKeyGenerated,
}: GenerateApiKeyModalProps): JSX.Element {
  const [step, setStep] = useState<'form' | 'generated'>('form');
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('90');
  const [generatedKey, setGeneratedKey] = useState<string>('');
  const [generatedName, setGeneratedName] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const createMutation = useCreateApiKey();

  const reset = useCallback(() => {
    setStep('form');
    setName('');
    setExpiry('90');
    setGeneratedKey('');
    setGeneratedName('');
    setCopied(false);
  }, []);

  const handleClose = (): void => {
    reset();
    onOpenChange(false);
  };

  const handleGenerate = (): void => {
    if (!name.trim()) {
      toast.error('Le nom de la clé est requis');
      return;
    }
    const expiresInDays = expiry === 'never' ? undefined : parseInt(expiry, 10);
    createMutation.mutate(
      { name: name.trim(), expiresInDays },
      {
        onSuccess: (created) => {
          setGeneratedKey(created.plainKey);
          setGeneratedName(created.name);
          setStep('generated');
          onKeyGenerated(created);
        },
        onError: (err) => {
          toast.error('Erreur lors de la création de la clé', {
            description: err.message,
          });
        },
      },
    );
  };

  const handleCopy = (): void => {
    try {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      toast.success('Clé API copiée dans le presse-papiers');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                Générer une clé API
              </DialogTitle>
              <DialogDescription>
                Créez une nouvelle clé d'accès pour l'API de la plateforme
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="key-name">Nom de la clé</Label>
                <Input
                  id="key-name"
                  placeholder="Ex : Production, CI/CD, Staging..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGenerate();
                  }}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Choisissez un nom descriptif pour identifier l'usage de cette clé
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="key-expiry">Expiration</Label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expiryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
                Annuler
              </Button>
              <Button onClick={handleGenerate} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Création...' : 'Générer la clé'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'generated' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-status-success" />
                Clé API générée
              </DialogTitle>
              <DialogDescription>
                Copiez cette clé maintenant — elle ne sera plus affichée
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-status-warning/20 bg-status-warning/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />
                <p className="text-xs text-status-warning/90">
                  Pour des raisons de sécurité, cette clé ne sera affichée qu'une seule fois.
                  Stockez-la dans un endroit sûr (gestionnaire de secrets).
                </p>
              </div>

              <div className="space-y-2">
                <Label>Clé</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs break-all select-all">
                    {generatedKey}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="shrink-0"
                    aria-label="Copier la clé"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-status-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-xs text-muted-foreground">
                <p>
                  Nom : <span className="text-foreground">{generatedName}</span>
                </p>
                <p>
                  Expiration : <span className="text-foreground">{formatExpires(expiry)}</span>
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>J'ai sauvegardé la clé</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

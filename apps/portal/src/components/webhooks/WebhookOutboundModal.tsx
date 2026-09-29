import { useState, useEffect, type JSX } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useCreateWebhookOutbound, useUpdateWebhookOutbound } from '@/hooks/useWebhookOutbound';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WebhookConfig } from '@kubernal/shared-types';

const ALL_EVENTS = [
  { value: 'started', label: 'Démarré' },
  { value: 'success', label: 'Succès' },
  { value: 'failure', label: 'Échec' },
  { value: 'rolled_back', label: 'Rollback' },
  { value: 'cancelled', label: 'Annulé' },
  { value: 'approval_needed', label: 'Approbation' },
] as const;

interface WebhookOutboundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  config: WebhookConfig | null;
  onSaved: () => void;
}

export function WebhookOutboundModal({
  open,
  onOpenChange,
  applicationId,
  config,
  onSaved,
}: WebhookOutboundModalProps): JSX.Element {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['started', 'success', 'failure']);
  const [error, setError] = useState<string | null>(null);

  const create = useCreateWebhookOutbound();
  const update = useUpdateWebhookOutbound();
  const {
    busy: submitting,
    acquire,
    release,
  } = useSubmitLock(create.isPending || update.isPending);

  const isEditing = !!config;

  useEffect(() => {
    if (config) {
      setName(config.name);
      setUrl(config.url);
      // The API never returns the HMAC secret (only `hasSecret`), so the field
      // always starts empty: leaving it blank keeps the current secret.
      setSecret('');
      setEnabled(config.enabled);
      setSelectedEvents(config.events);
    } else {
      setName('');
      setUrl('');
      setSecret('');
      setEnabled(true);
      setSelectedEvents(['started', 'success', 'failure']);
    }
    setError(null);
  }, [config, open]);

  const toggleEvent = (ev: string): void => {
    setSelectedEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  };

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    if (!url) {
      setError('URL requise');
      return;
    }
    try {
      new URL(url);
    } catch {
      setError('URL invalide');
      return;
    }
    if (selectedEvents.length === 0) {
      setError('Sélectionnez au moins un événement');
      return;
    }
    if (!acquire()) return;

    if (isEditing) {
      update.mutate(
        {
          id: config.id,
          data: { name, url, ...(secret ? { secret } : {}), events: selectedEvents, enabled },
        },
        {
          onSuccess: () => {
            toast.success('Webhook mis à jour');
            onSaved();
          },
          onError: (e) => setError(e.message),
          onSettled: () => release(),
        },
      );
    } else {
      create.mutate(
        {
          applicationId,
          name,
          url,
          secret: secret || undefined,
          events: selectedEvents,
        },
        {
          onSuccess: () => {
            toast.success('Webhook créé');
            onSaved();
          },
          onError: (e) => setError(e.message),
          onSettled: () => release(),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifier le webhook' : 'Nouveau webhook sortant'}</DialogTitle>
          <DialogDescription>
            Notifications Slack envoyées lors des événements de déploiement
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wh-name">Nom</Label>
            <Input
              id="wh-name"
              placeholder="Ex: Slack #déploiements"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wh-url">URL du webhook Slack</Label>
            <Input
              id="wh-url"
              placeholder="https://hooks.slack.com/services/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wh-secret">Secret (optionnel)</Label>
            <Input
              id="wh-secret"
              placeholder="Pour signature HMAC"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            {isEditing && config?.hasSecret && (
              <p className="text-xs text-muted-foreground">
                Un secret est déjà configuré (jamais affiché). Laissez vide pour le conserver.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Événements</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map((ev) => (
                <Button
                  key={ev.value}
                  type="button"
                  variant={selectedEvents.includes(ev.value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleEvent(ev.value)}
                >
                  {ev.label}
                </Button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-status-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              aria-busy={submitting}
            >
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} aria-busy={submitting}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {submitting
                ? isEditing
                  ? 'Enregistrement…'
                  : 'Création…'
                : isEditing
                  ? 'Mettre à jour'
                  : 'Créer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

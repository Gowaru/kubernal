import { useState, type JSX } from 'react';
import { Bell, Plus, Trash2, Play, ExternalLink, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useWebhookOutboundConfigs,
  useDeleteWebhookOutbound,
  useTestWebhookOutbound,
  useWebhookDeliveries,
} from '@/hooks/useWebhookOutbound';
import { WebhookOutboundModal } from './WebhookOutboundModal';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/utils';
import type { WebhookConfig, WebhookDelivery } from '@kubernal/shared-types';

interface WebhookOutboundCardProps {
  applicationId: string;
}

const EVENT_LABELS: Record<string, string> = {
  started: 'Démarré',
  success: 'Succès',
  failure: 'Échec',
  rolled_back: 'Rollback',
  cancelled: 'Annulé',
  approval_needed: 'Approbation',
};

function DeliveryIcon({ status }: { status: WebhookDelivery['status'] }): JSX.Element {
  if (status === 'success') return <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />;
  if (status === 'failed') return <XCircle className="h-3.5 w-3.5 text-status-error" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />;
}

function DeliveryList({ configId }: { configId: string }): JSX.Element {
  const { data: deliveries, isLoading } = useWebhookDeliveries(configId);
  if (isLoading) return <Skeleton className="h-12 w-full" />;
  if (!deliveries?.length)
    return <p className="text-xs text-muted-foreground py-2">Aucune livraison</p>;
  return (
    <div className="space-y-1 max-h-32 overflow-y-auto">
      {deliveries.slice(0, 5).map((d) => (
        <div key={d.id} className="flex items-center gap-2 text-xs text-muted-foreground">
          <DeliveryIcon status={d.status} />
          <span className="font-mono">{d.event}</span>
          {d.responseStatus && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {d.responseStatus}
            </Badge>
          )}
          <span className="ml-auto">{formatRelativeTime(d.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

function ConfigRow({
  config,
  onEdit,
}: {
  config: WebhookConfig;
  onEdit: (c: WebhookConfig) => void;
}): JSX.Element {
  const del = useDeleteWebhookOutbound();
  const test = useTestWebhookOutbound();

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{config.name}</span>
          {!config.enabled && (
            <Badge variant="outline" className="text-[10px]">
              Désactivé
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Tester"
            onClick={() => {
              test.mutate(config.id, {
                onSuccess: () => toast.success('Webhook de test envoyé'),
                onError: () => toast.error('Échec du test'),
              });
            }}
            disabled={test.isPending}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Modifier"
            onClick={() => onEdit(config)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-status-error"
            title="Supprimer"
            onClick={() => {
              if (window.confirm('Supprimer ce webhook ?')) {
                del.mutate(config.id, {
                  onSuccess: () => toast.success('Webhook supprimé'),
                  onError: () => toast.error('Échec de la suppression'),
                });
              }
            }}
            disabled={del.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <code className="block text-xs font-mono text-muted-foreground truncate">{config.url}</code>
      <div className="flex items-center gap-1.5 flex-wrap">
        {config.events.map((ev) => (
          <Badge key={ev} variant="secondary" className="text-[10px]">
            {EVENT_LABELS[ev] ?? ev}
          </Badge>
        ))}
      </div>
      <DeliveryList configId={config.id} />
    </div>
  );
}

export function WebhookOutboundCard({ applicationId }: WebhookOutboundCardProps): JSX.Element {
  const { data: configs, isLoading } = useWebhookOutboundConfigs(applicationId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WebhookConfig | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Webhooks sortants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Webhooks sortants
            </CardTitle>
            <CardDescription>Notifications Slack sur les événements de déploiement</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingConfig(null);
              setModalOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ajouter
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {!configs?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun webhook sortant configuré
            </p>
          ) : (
            configs.map((c) => (
              <ConfigRow
                key={c.id}
                config={c}
                onEdit={(cfg) => {
                  setEditingConfig(cfg);
                  setModalOpen(true);
                }}
              />
            ))
          )}
        </CardContent>
      </Card>
      <WebhookOutboundModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        applicationId={applicationId}
        config={editingConfig}
        onSaved={() => setModalOpen(false)}
      />
    </>
  );
}

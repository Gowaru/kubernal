import { Globe, Network, ExternalLink, Copy, Terminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { JSX } from 'react';
import { useDeploymentAccess } from '@/hooks/useDeploymentAccess';

interface DeploymentAccessCardProps {
  deploymentId: string;
}

function copyToClipboard(text: string, label: string): void {
  void navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${label} copié dans le presse-papier`))
    .catch(() => toast.error('Échec de la copie'));
}

export function DeploymentAccessCard({ deploymentId }: DeploymentAccessCardProps): JSX.Element {
  const { data, isLoading, error } = useDeploymentAccess(deploymentId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            Accès au déploiement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chargement des URLs d'accès…</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            Accès au déploiement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-status-error">Impossible de récupérer les informations d'accès.</p>
        </CardContent>
      </Card>
    );
  }

  const badgeClass = {
    nodeport: 'bg-status-success/10 text-status-success border-status-success/30',
    clusterip: 'bg-status-info/10 text-status-info border-status-info/30',
    none: 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/30',
  }[data.type];

  const typeLabel = {
    nodeport: 'NodePort',
    clusterip: 'ClusterIP',
    none: 'Pas de service',
  }[data.type];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Accès au déploiement
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${badgeClass}`}
          >
            {typeLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.serviceName && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Network className="h-3 w-3" />
            <span className="font-mono">{data.serviceName}</span>
            <span>·</span>
            <span>{data.ports.length} port(s)</span>
          </div>
        )}

        {data.urls.length > 0 ? (
          <div className="space-y-2">
            {data.urls.map((u) => (
              <div
                key={`${u.port}-${u.nodePort ?? 'internal'}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Port {u.port}</span>
                    {u.nodePort && <span>· NodePort {u.nodePort}</span>}
                  </div>
                  <code className="text-xs font-mono truncate text-foreground">{u.url}</code>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(u.url, 'URL')}
                    title="Copier l'URL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {u.kind === 'nodeport' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      asChild
                      title="Ouvrir dans un nouvel onglet"
                    >
                      <a href={u.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun service Kubernetes trouvé pour ce déploiement.
          </p>
        )}

        {data.suggestion && (
          <div className="space-y-1.5 rounded-md border border-dashed border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Terminal className="h-3 w-3" />
              Port-forward (dev local)
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-foreground truncate">
                {data.suggestion}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => copyToClipboard(data.suggestion ?? '', 'Commande')}
                title="Copier la commande"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

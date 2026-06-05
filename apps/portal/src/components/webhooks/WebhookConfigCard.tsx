import { useState, type JSX } from 'react';
import { Github, GitBranch, Copy, RefreshCw, ExternalLink, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWebhookConfig, useRegenerateWebhook } from '@/hooks/useWebhookConfig';
import { detectProvider } from '@/lib/repo-utils';
import { toast } from 'sonner';

interface WebhookConfigCardProps {
  applicationId: string;
  repositoryUrl: string | null | undefined;
}

function copyToClipboard(text: string, label: string): void {
  void navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${label} copié dans le presse-papier`))
    .catch(() => toast.error('Échec de la copie'));
}

const PROVIDER_LABEL = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
} as const;

const PROVIDER_DOCS = {
  github: 'https://docs.github.com/webhooks/using-webhooks/creating-webhooks',
  gitlab: 'https://docs.gitlab.com/ee/user/project/integrations/webhooks.html',
  bitbucket: 'https://support.atlassian.com/bitbucket-cloud/docs/manage-webhooks/',
} as const;

export function WebhookConfigCard({
  applicationId,
  repositoryUrl,
}: WebhookConfigCardProps): JSX.Element {
  const { data, isLoading } = useWebhookConfig(applicationId);
  const regenerate = useRegenerateWebhook();
  const [showSecret, setShowSecret] = useState(false);
  const [lastSecret, setLastSecret] = useState<string | null>(null);

  const provider = repositoryUrl ? detectProvider(repositoryUrl) : null;
  const validProvider = provider === 'github' || provider === 'gitlab' || provider === 'bitbucket' ? provider : null;
  const Icon = validProvider === 'github' ? Github : GitBranch;
  const providerLabel = validProvider ? PROVIDER_LABEL[validProvider] : 'Repository';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Github className="h-4 w-4" />
            Webhook
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return <></>;

  const handleRegenerate = (): void => {
    if (
      window.confirm(
        'Régénérer le secret ? Le nouveau secret sera affiché une seule fois, vous devrez le mettre à jour sur votre provider Git.',
      )
    ) {
      regenerate.mutate(applicationId, {
        onSuccess: (result) => {
          setLastSecret(result.secret);
          setShowSecret(true);
          toast.success('Secret régénéré', {
            description: 'Copiez-le maintenant et mettez à jour votre provider Git.',
          });
        },
        onError: () => {
          toast.error('Échec de la régénération du secret');
        },
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          Webhook {providerLabel}
        </CardTitle>
        <CardDescription>
          Configurez cette URL sur votre repository pour déclencher un déploiement dev à chaque push.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">URL du webhook</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono truncate">
              {data.url}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => copyToClipboard(data.url, 'URL')}
              title="Copier l'URL"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Secret</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono truncate">
              {showSecret && lastSecret
                ? lastSecret
                : data.hasSecret
                  ? 'whsec_••••••••••••••••••••••••'
                  : '(non configuré)'}
            </code>
            {data.hasSecret && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setShowSecret((s) => !s)}
                  title={showSecret ? 'Masquer le secret' : 'Afficher le secret'}
                >
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => copyToClipboard(lastSecret ?? 'secret-stocké', 'Secret')}
                  title="Copier le secret"
                  disabled={!lastSecret}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerate.isPending}
              className="shrink-0"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${regenerate.isPending ? 'animate-spin' : ''}`} />
              Régénérer
            </Button>
          </div>
          {lastSecret && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              Nouveau secret généré. Copiez-le maintenant, il ne sera plus affiché.
            </p>
          )}
        </div>

        <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Instructions :</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>
              Aller dans Settings → Webhooks de votre repository {providerLabel}
            </li>
            <li>
              Coller l'URL ci-dessus dans le champ "Payload URL"
            </li>
            <li>
              Coller le secret dans le champ "Secret"
            </li>
            <li>
              Sélectionner l'événement "push" (Content type: application/json)
            </li>
            <li>
              Activer le webhook et pousser un commit pour tester
            </li>
          </ol>
          <a
            href={validProvider ? PROVIDER_DOCS[validProvider] : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
          >
            Documentation {providerLabel}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

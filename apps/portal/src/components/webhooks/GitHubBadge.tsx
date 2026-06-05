import { Github, GitBranch, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { JSX } from 'react';
import type { WebhookConfig } from '@/hooks/useWebhookConfig';

interface GitHubBadgeProps {
  config: WebhookConfig | undefined;
  isLoading?: boolean;
}

const PROVIDER_LABEL: Record<WebhookConfig['provider'], string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
};

const PROVIDER_ICON: Record<WebhookConfig['provider'], typeof Github> = {
  github: Github,
  gitlab: GitBranch,
  bitbucket: GitBranch,
};

export function GitHubBadge({ config, isLoading }: GitHubBadgeProps): JSX.Element {
  if (isLoading) {
    return (
      <Badge variant="outline" className="border-border text-muted-foreground">
        …
      </Badge>
    );
  }

  if (!config) {
    return (
      <Badge variant="outline" className="border-zinc-500/30 bg-zinc-500/10 text-zinc-400">
        <X className="mr-1 h-3 w-3" />
        Webhook non configuré
      </Badge>
    );
  }

  const Icon = PROVIDER_ICON[config.provider];
  const label = PROVIDER_LABEL[config.provider];

  if (!config.hasSecret) {
    return (
      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400">
        <Icon className="mr-1 h-3 w-3" />
        {label} · secret manquant
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
      <Check className="mr-1 h-3 w-3" />
      {label} connecté
    </Badge>
  );
}

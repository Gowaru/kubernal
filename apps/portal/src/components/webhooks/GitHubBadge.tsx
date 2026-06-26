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
      <Badge variant="outline" className="border-muted-foreground/30 bg-muted-foreground/10 text-muted-foreground">
        <X className="mr-1 h-3 w-3" />
        Webhook non configuré
      </Badge>
    );
  }

  const Icon = PROVIDER_ICON[config.provider];
  const label = PROVIDER_LABEL[config.provider];

  if (!config.hasSecret) {
    return (
      <Badge variant="outline" className="border-status-warning/30 bg-status-warning/10 text-status-warning">
        <Icon className="mr-1 h-3 w-3" />
        {label} · secret non configuré
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-status-success/30 bg-status-success/10 text-status-success">
      <Check className="mr-1 h-3 w-3" />
      {label} connecté
    </Badge>
  );
}

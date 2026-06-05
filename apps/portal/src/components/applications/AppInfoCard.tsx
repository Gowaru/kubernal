import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileJson, User, GitBranch, ExternalLink } from 'lucide-react';
import type { JSX } from 'react';
import type { Team, GoldenPathTemplate } from '@kubernal/shared-types';
import { getRepoUrl } from '@/lib/repo-utils';
import { GitHubBadge } from '@/components/webhooks/GitHubBadge';
import { useWebhookConfig } from '@/hooks/useWebhookConfig';

interface AppInfoCardProps {
  team: Team | undefined;
  template: GoldenPathTemplate | undefined;
  ownerName: string | undefined;
  repositoryUrl: string | null | undefined;
  applicationId: string;
}

export function AppInfoCard({
  team,
  template,
  ownerName,
  repositoryUrl,
  applicationId,
}: AppInfoCardProps): JSX.Element {
  const { data: webhookConfig, isLoading: webhookLoading } = useWebhookConfig(applicationId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Informations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Équipe</p>
            <p className="text-sm text-muted-foreground">{team?.name ?? '-'}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Namespace</p>
            <p className="text-sm text-muted-foreground font-mono">
              {team?.namespacePrefix ?? '-'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <FileJson className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Template</p>
            <p className="text-sm text-muted-foreground">
              {template?.name ?? '-'}
              {template?.version ? ` v${template.version}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Propriétaire</p>
            <p className="text-sm text-muted-foreground">{ownerName ?? '-'}</p>
          </div>
        </div>

        {repositoryUrl && (
          <div className="flex items-start gap-3">
            <GitBranch className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium">Dépôt</p>
              {getRepoUrl(repositoryUrl) ? (
                <a
                  href={getRepoUrl(repositoryUrl) ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex max-w-full items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="font-mono truncate">{repositoryUrl}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground font-mono truncate max-w-[200px]">
                  {repositoryUrl}
                </p>
              )}
              <div>
                <GitHubBadge config={webhookConfig} isLoading={webhookLoading} />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

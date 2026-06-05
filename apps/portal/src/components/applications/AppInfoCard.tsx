import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileJson, User, GitBranch } from 'lucide-react';
import type { JSX } from 'react';
import type { Team, GoldenPathTemplate } from '@kubernal/shared-types';

interface AppInfoCardProps {
  team: Team | undefined;
  template: GoldenPathTemplate | undefined;
  ownerName: string | undefined;
  repositoryUrl: string | null | undefined;
}

export function AppInfoCard({ team, template, ownerName, repositoryUrl }: AppInfoCardProps): JSX.Element {
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
            <div>
              <p className="text-sm font-medium">Dépôt</p>
              <p className="text-sm text-muted-foreground font-mono truncate max-w-[200px]">
                {repositoryUrl}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

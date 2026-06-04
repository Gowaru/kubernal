import { Card, CardContent } from '@/components/ui/card';
import { Users, Cpu, HardDrive, FolderKanban, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Team } from '@kubernal/shared-types';

interface TeamCardProps {
  team: Team;
  appCount?: number;
}

export function TeamCard({ team, appCount = 0 }: TeamCardProps) {
  return (
    <Card className="group transition-all duration-200 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold group-hover:text-accent transition-colors">
                {team.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {team.namespacePrefix}
              </p>
            </div>
          </div>
        </div>

        {team.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {team.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-secondary/50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
              <Cpu className="h-3.5 w-3.5" />
              CPU
            </div>
            <p className="text-sm font-medium">{team.quotaCpu}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
              <HardDrive className="h-3.5 w-3.5" />
              Mémoire
            </div>
            <p className="text-sm font-medium">{team.quotaMemory}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FolderKanban className="h-3.5 w-3.5" />
            {appCount} applications
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(team.createdAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

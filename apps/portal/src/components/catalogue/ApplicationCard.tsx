import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';
import { getApplicationStatus } from '@/lib/status-config';
import { Rocket, Clock } from 'lucide-react';
import type { JSX } from 'react';
import type { Application } from '@kubernal/shared-types';

interface ApplicationCardProps {
  application: Application;
  onDeploy: (app: Application) => void;
}

export function ApplicationCard({ application, onDeploy }: ApplicationCardProps): JSX.Element {
  const navigate = useNavigate();
  const status = getApplicationStatus(application.status);

  return (
    <Card className="group transition-all duration-200 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3
              className="font-semibold tracking-tight group-hover:text-accent transition-colors cursor-pointer"
              onClick={() => navigate(`/catalogue/${application.id}`)}
            >
              {application.name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {application.description ?? 'Aucune description'}
            </p>
          </div>
          <Badge variant="outline" className={`flex items-center gap-1.5 ${status.className}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </Badge>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatRelativeTime(application.createdAt)}
          </span>
        </div>
      </CardContent>
      <CardFooter className="border-t border-border px-5 py-3">
        <Button size="sm" className="w-full gap-2" onClick={() => onDeploy(application)}>
          <Rocket className="h-4 w-4" />
          Déployer
        </Button>
      </CardFooter>
    </Card>
  );
}

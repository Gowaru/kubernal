import { Card, CardContent } from '@/components/ui/card';
import { Rocket } from 'lucide-react';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function WelcomeCard() {
  const today = dateFormatter.format(new Date());

  return (
    <Card className="relative overflow-hidden border-blue-500/20 bg-gradient-to-br from-blue-950/40 via-card to-violet-950/30">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{today}</p>
            <h1 className="text-2xl font-bold tracking-tight">
              Bienvenue sur <span className="text-blue-400">Kubernal</span>
            </h1>
            <p className="text-muted-foreground">
              Plateforme interne de déploiement — gérez vos applications, environnements et déploiements.
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20">
            <Rocket className="h-7 w-7 text-blue-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

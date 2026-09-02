import { Card, CardContent } from '@/components/ui/card';
import { Rocket } from 'lucide-react';
import type { JSX } from 'react';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function WelcomeCard(): JSX.Element {
  const today = dateFormatter.format(new Date());

  return (
    <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-accent/10 via-card to-accent/5">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{today}</p>
            <h1 className="text-2xl font-bold tracking-tight">
              Bienvenue sur <span className="text-accent">Kubernal</span>
            </h1>
            <p className="text-muted-foreground">
              Plateforme interne de déploiement — gérez vos applications, environnements et
              déploiements.
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/20">
            <Rocket className="h-7 w-7 text-accent" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

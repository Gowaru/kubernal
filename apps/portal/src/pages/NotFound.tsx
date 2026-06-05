import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, LayoutGrid, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JSX } from 'react';

export default function NotFound(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="relative w-full max-w-lg">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-accent/5 via-transparent to-transparent rounded-3xl blur-3xl" />
        <div className="flex flex-col items-center text-center space-y-6 p-8">
          <div className="relative">
            <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20">
              <Compass className="h-12 w-12 text-accent" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-mono font-medium uppercase tracking-widest text-muted-foreground">
              Erreur 404
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Page introuvable</h1>
            <p className="text-sm text-muted-foreground max-w-md">
              L'URL demandée n'existe pas ou a été déplacée. Vérifiez l'orthographe ou revenez à une page connue.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button onClick={() => navigate('/')} className="min-w-40">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour au Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate('/catalogue')} className="min-w-40">
              <LayoutGrid className="mr-2 h-4 w-4" />
              Voir le catalogue
            </Button>
          </div>

          <div className="pt-4 text-xs text-muted-foreground/60 flex items-center gap-1.5">
            <Search className="h-3 w-3" />
            <span>Astuce : utilisez ⌘K pour ouvrir la recherche globale</span>
          </div>
        </div>
      </div>
    </div>
  );
}

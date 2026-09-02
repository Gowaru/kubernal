import { AlertTriangle, RotateCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { JSX } from 'react';

interface ErrorFallbackProps {
  error?: Error;
  resetErrorBoundary?: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-status-error/10">
          <AlertTriangle className="h-8 w-8 text-status-error" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Une erreur inattendue est survenue
        </h1>
        <p className="text-muted-foreground mb-2">
          L'application a rencontré un problème. Vous pouvez réessayer ou revenir au tableau de
          bord.
        </p>
        {error?.message && (
          <p className="text-xs text-muted-foreground font-mono mb-6 bg-muted rounded-lg p-3">
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          {resetErrorBoundary && (
            <button
              onClick={resetErrorBoundary}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              <RotateCw className="h-4 w-4" />
              Réessayer
            </button>
          )}
          <button
            onClick={() => {
              resetErrorBoundary?.();
              navigate('/');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Home className="h-4 w-4" />
            Retour au tableau de bord
          </button>
        </div>
      </div>
    </div>
  );
}

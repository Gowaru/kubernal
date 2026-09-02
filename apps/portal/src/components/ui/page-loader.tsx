import type { JSX } from 'react';
import { Loader2 } from 'lucide-react';

export default function PageLoader(): JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 animate-[fade-in-up_0.5s_ease-out]">
      <img
        src="/other-logo-kubernal.png"
        alt="Kubernal"
        className="h-16 w-16 object-contain animate-pulse-glow"
      />
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground animate-pulse">Chargement...</p>
    </div>
  );
}

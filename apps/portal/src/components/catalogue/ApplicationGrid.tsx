import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { useApplications } from '@/hooks/useApplications';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApplicationCard } from './ApplicationCard';
import { DeploymentModal } from '@/components/deployments/DeploymentModal';
import type { Application } from '@kubernal/shared-types';

export function ApplicationGrid() {
  const { data: applications, isLoading, error } = useApplications();
  const [search, setSearch] = useState('');
  const [deployTarget, setDeployTarget] = useState<Application | null>(null);

  const filtered = (applications ?? []).filter((app) =>
    app.name.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (error) toast.error('Erreur lors du chargement des applications');
  }, [error]);

  return (
    <>
      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une application..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-5 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
                <div className="flex gap-4 pt-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
            <p className="text-sm text-muted-foreground">
              {search ? 'Aucune application trouvée' : 'Aucune application'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                onDeploy={setDeployTarget}
              />
            ))}
          </div>
        )}
      </div>

      <DeploymentModal
        open={!!deployTarget}
        onOpenChange={(open) => !open && setDeployTarget(null)}
        preselectedApp={deployTarget ?? undefined}
      />
    </>
  );
}

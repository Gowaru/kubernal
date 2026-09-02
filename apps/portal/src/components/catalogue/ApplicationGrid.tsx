import { useState, useEffect, type JSX } from 'react';
import { toast } from 'sonner';
import { useCatalogueApplications, type CatalogueFilters } from '@/hooks/useApplications';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { ApplicationCard } from './ApplicationCard';
import { DeploymentModal } from '@/components/deployments/DeploymentModal';
import type { Application } from '@kubernal/shared-types';

interface ApplicationGridProps {
  filters: CatalogueFilters;
  onFiltersChange: (filters: CatalogueFilters) => void;
}

export function ApplicationGrid({ filters, onFiltersChange }: ApplicationGridProps): JSX.Element {
  const { data, isLoading, error } = useCatalogueApplications(filters);
  const [deployTarget, setDeployTarget] = useState<Application | null>(null);

  const applications = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize ?? 20)));

  useEffect(() => {
    if (error) toast.error('Erreur lors du chargement des applications');
  }, [error]);

  return (
    <>
      <div className="space-y-6">
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
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
            <p className="text-sm text-muted-foreground">
              {filters.search || filters.teamId || filters.status || filters.templateId
                ? 'Aucune application trouvée avec ces filtres'
                : 'Aucune application'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {applications.map((app) => (
                <ApplicationCard key={app.id} application={app} onDeploy={setDeployTarget} />
              ))}
            </div>

            <PaginationBar
              pagination={{
                page: filters.page ?? 0,
                pageSize: filters.pageSize ?? 20,
                totalPages,
                total,
                from: total === 0 ? 0 : (filters.page ?? 0) * (filters.pageSize ?? 20) + 1,
                to: Math.min(((filters.page ?? 0) + 1) * (filters.pageSize ?? 20), total),
              }}
              onPageChange={(page) => onFiltersChange({ ...filters, page })}
              onPageSizeChange={(pageSize) => onFiltersChange({ ...filters, pageSize, page: 0 })}
            />
          </>
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

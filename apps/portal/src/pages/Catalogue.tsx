import { useState, type JSX } from 'react';
import { ApplicationTable } from '@/components/catalogue/ApplicationTable';
import { ApplicationGrid } from '@/components/catalogue/ApplicationGrid';
import { CatalogueFilters } from '@/components/catalogue/CatalogueFilters';
import { CreateApplicationModal } from '@/components/applications/CreateApplicationModal';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, Table2 } from 'lucide-react';
import type { CatalogueFilters as Filters } from '@/hooks/useApplications';

export default function Catalogue(): JSX.Element {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filters, setFilters] = useState<Filters>({ page: 0, pageSize: 20 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Catalogue</h2>
          <p className="text-muted-foreground">Explorez les applications de la plateforme.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <Button
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setView('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
              Grille
            </Button>
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setView('table')}
            >
              <Table2 className="h-4 w-4" />
              Tableau
            </Button>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle application
          </Button>
        </div>
      </div>

      <CatalogueFilters filters={filters} onChange={setFilters} />

      {view === 'grid' ? (
        <ApplicationGrid filters={filters} onFiltersChange={setFilters} />
      ) : (
        <ApplicationTable filters={filters} onFiltersChange={setFilters} />
      )}

      <CreateApplicationModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </div>
  );
}

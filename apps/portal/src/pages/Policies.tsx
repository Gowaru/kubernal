import { useState, useMemo, useCallback, useEffect, type JSX } from 'react';
import { Shield, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { usePolicies, useTogglePolicy } from '@/hooks/usePolicies';
import { PolicyCard } from '@/components/policies/PolicyCard';
import type { PolicyCategory } from '@kubernal/shared-types';

const categoryFilters: { label: string; value: PolicyCategory | '' }[] = [
  { label: 'Toutes', value: '' },
  { label: 'Sécurité', value: 'security' },
  { label: 'Conformité', value: 'compliance' },
  { label: 'Coût', value: 'cost' },
  { label: 'Opérations', value: 'operations' },
];

export default function Policies(): JSX.Element {
  const { data: policies, isLoading, error } = usePolicies();
  const togglePolicy = useTogglePolicy();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PolicyCategory | ''>('');

  const filtered = useMemo(() => {
    return (policies ?? []).filter((p) => {
      if (
        search &&
        !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.description.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (categoryFilter && p.category !== categoryFilter) return false;
      return true;
    });
  }, [policies, search, categoryFilter]);

  const totalEnabled = useMemo(() => (policies ?? []).filter((p) => p.enabled).length, [policies]);
  const totalCritical = useMemo(
    () => (policies ?? []).filter((p) => p.severity === 'critical').length,
    [policies],
  );
  const totalDisabled = useMemo(
    () => (policies ?? []).filter((p) => !p.enabled).length,
    [policies],
  );

  const handleToggle = useCallback(
    (id: string, enabled: boolean) => {
      const name = (policies ?? []).find((p) => p.id === id)?.name ?? '';
      togglePolicy.mutate(
        { id, enabled },
        {
          onSuccess: () =>
            toast.success(`Politique "${name}" ${enabled ? 'activée' : 'désactivée'}`),
          onError: () => toast.error('Erreur lors de la modification de la politique'),
        },
      );
    },
    [togglePolicy, policies],
  );

  useEffect(() => {
    if (error) toast.error('Erreur lors du chargement des politiques');
  }, [error]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Politiques</h2>
        <p className="text-muted-foreground">Gérez les politiques de sécurité et conformité.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total" value={isLoading ? '—' : (policies?.length ?? 0)} icon={Shield} />
        <StatsCard title="Activées" value={isLoading ? '—' : totalEnabled} icon={Shield} />
        <StatsCard title="Critiques" value={isLoading ? '—' : totalCritical} icon={Shield} />
        <StatsCard title="Désactivées" value={isLoading ? '—' : totalDisabled} icon={Shield} />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une politique..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {categoryFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setCategoryFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryFilter === f.value
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-5 space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <Shield className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search || categoryFilter ? 'Aucune politique trouvée' : 'Aucune politique'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PolicyCard
              key={p.id}
              policy={p}
              onToggle={handleToggle}
              toggling={togglePolicy.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

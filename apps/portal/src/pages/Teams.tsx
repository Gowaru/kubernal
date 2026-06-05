import { useState, useEffect, type JSX } from 'react';
import { toast } from 'sonner';
import { useTeams } from '@/hooks/useTeams';
import { CreateTeamModal } from '@/components/teams/CreateTeamModal';
import { TeamCard } from '@/components/teams/TeamCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function Teams(): JSX.Element {
  const { data: teams, isLoading, error } = useTeams();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filtered = (teams ?? []).filter((team) =>
    team.name.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (error) toast.error('Erreur lors du chargement des équipes');
  }, [error]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Équipes</h2>
          <p className="text-muted-foreground">Gérez les équipes de la plateforme.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle équipe
        </Button>
      </div>

      <CreateTeamModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher une équipe..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? 'Aucune équipe trouvée' : 'Aucune équipe'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team) => (
            <TeamCard key={team.id} team={team} appCount={team._count?.applications ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}

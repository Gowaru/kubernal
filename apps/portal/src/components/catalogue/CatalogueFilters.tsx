import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTeams } from '@/hooks/useTeams';
import { useTemplates } from '@/hooks/useTemplates';
import { APPLICATION_STATUS_CONFIG } from '@/lib/status-config';
import type { CatalogueFilters as Filters } from '@/hooks/useApplications';
import type { JSX } from 'react';

interface CatalogueFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function CatalogueFilters({ filters, onChange }: CatalogueFiltersProps): JSX.Element {
  const { data: teams } = useTeams();
  const { data: templates } = useTemplates();

  const hasActiveFilters = filters.search || filters.teamId || filters.status || filters.templateId;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[240px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher une application..."
          value={filters.search ?? ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined, page: 0 })}
          className="pl-10"
        />
      </div>

      <Select
        value={filters.teamId ?? '_all'}
        onValueChange={(v) => onChange({ ...filters, teamId: v === '_all' ? undefined : v, page: 0 })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Équipe" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Toutes les équipes</SelectItem>
          {(teams ?? []).map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status ?? '_all'}
        onValueChange={(v) => onChange({ ...filters, status: v === '_all' ? undefined : v, page: 0 })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tous les statuts</SelectItem>
          {Object.entries(APPLICATION_STATUS_CONFIG).map(([key, cfg]) => (
            <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.templateId ?? '_all'}
        onValueChange={(v) => onChange({ ...filters, templateId: v === '_all' ? undefined : v, page: 0 })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Template" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tous les templates</SelectItem>
          {(templates ?? []).map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ page: 0 })}
          className="h-9 gap-1.5"
        >
          <X className="h-4 w-4" />
          Effacer
        </Button>
      ) : null}
    </div>
  );
}

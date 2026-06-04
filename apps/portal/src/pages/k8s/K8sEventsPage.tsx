import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Search, Filter } from 'lucide-react';
import { K8sContextBar } from '@/components/k8s/K8sContextBar';
import { K8sEventFeed } from '@/components/k8s/K8sEventFeed';
import { useK8sEvents } from '@/hooks/useK8sEvents';
import { MOCK_CLUSTER } from '@/mocks/k8s-data';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { K8sEvent } from '@kubernal/shared-types';

function formatRelativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

export default function K8sEventsPage() {
  const { data: events = [], isLoading, error } = useK8sEvents(MOCK_CLUSTER.namespace);

  useEffect(() => {
    if (error) {
      toast.error('Erreur lors du chargement des données', {
        description: (error as Error)?.message || 'Veuillez réessayer',
      });
    }
  }, [error]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchType = typeFilter === 'all' || e.type === typeFilter;
      const matchSearch =
        !search ||
        e.reason.toLowerCase().includes(search.toLowerCase()) ||
        e.message.toLowerCase().includes(search.toLowerCase()) ||
        e.involvedObject.toLowerCase().includes(search.toLowerCase()) ||
        e.source.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [events, search, typeFilter]);

  const stats = useMemo(() => {
    const warnings = events.filter((e) => e.type === 'Warning').length;
    const normal = events.filter((e) => e.type === 'Normal').length;
    return { total: events.length, warnings, normal };
  }, [events]);

  return (
    <div className="space-y-6">
      <K8sContextBar
        cluster={MOCK_CLUSTER}
        namespace={MOCK_CLUSTER.namespace}
        branch="main"
        revision="a3f7c1e"
      />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-k8s-pending/10 border border-k8s-pending/20">
            <AlertTriangle className="h-5 w-5 text-k8s-pending" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Événements Kubernetes</h2>
            <p className="text-xs text-muted-foreground">
              {stats.total} événements · {stats.warnings} avertissements · {stats.normal} normaux
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-sm">Tous les événements</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 w-56"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-8 w-40">
                    <Filter className="h-3.5 w-3.5 mr-2 shrink-0" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Warning">Avertissement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg m-4">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">Aucun événement</h3>
                <p className="text-muted-foreground text-sm">Aucun événement ne correspond à vos critères</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Raison</TableHead>
                    <TableHead>Objet</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="text-center">Count</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Dernier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered
                    .sort(
                      (a, b) =>
                        new Date(b.lastTimestamp).getTime() -
                        new Date(a.lastTimestamp).getTime(),
                    )
                    .map((event: K8sEvent) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-medium',
                              event.type === 'Warning'
                                ? 'bg-k8s-pending/20 text-k8s-pending border-k8s-pending/30'
                                : 'bg-k8s-running/20 text-k8s-running border-k8s-running/30',
                            )}
                          >
                            {event.type === 'Warning' ? 'Avertissement' : 'Normal'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">
                          {event.reason}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[180px]">
                          {event.involvedObject}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {event.message}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs font-mono text-muted-foreground">
                            {event.count}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {event.source}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelativeTime(event.lastTimestamp)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Flux en temps réel</CardTitle>
          </CardHeader>
          <CardContent>
            <K8sEventFeed events={events} maxItems={15} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

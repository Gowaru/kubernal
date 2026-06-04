import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Network, Search, Filter } from 'lucide-react';
import { K8sContextBar } from '@/components/k8s/K8sContextBar';
import { useK8sServices } from '@/hooks/useK8sServices';
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
import type { K8sServiceType } from '@kubernal/shared-types';

const TYPE_COLORS: Record<K8sServiceType, string> = {
  LoadBalancer: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  NodePort: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ClusterIP: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  ExternalName: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function formatAge(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

function formatPorts(ports: { name: string; port: number; targetPort: number; protocol: string; nodePort?: number }[]): string {
  return ports
    .map((p) => {
      const base = `${p.port}:${p.targetPort}/${p.protocol}`;
      return p.nodePort ? `${base} (${p.nodePort})` : base;
    })
    .join(', ');
}

export default function K8sServicesPage() {
  const { data: services = [], isLoading, error } = useK8sServices();

  useEffect(() => {
    if (error) {
      toast.error('Erreur lors du chargement des données', {
        description: (error as Error)?.message || 'Veuillez réessayer',
      });
    }
  }, [error]);
  const [search, setSearch] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');

  const namespaces = useMemo(
    () => Array.from(new Set(services.map((s) => s.namespace))).sort(),
    [services],
  );

  const filtered = useMemo(() => {
    return services.filter((s) => {
      const matchNs = namespaceFilter === 'all' || s.namespace === namespaceFilter;
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.namespace.toLowerCase().includes(search.toLowerCase()) ||
        s.type.toLowerCase().includes(search.toLowerCase());
      return matchNs && matchSearch;
    });
  }, [services, search, namespaceFilter]);

  const stats = useMemo(() => {
    const lb = services.filter((s) => s.type === 'LoadBalancer').length;
    const np = services.filter((s) => s.type === 'NodePort').length;
    const cip = services.filter((s) => s.type === 'ClusterIP').length;
    return { total: services.length, lb, np, cip };
  }, [services]);

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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-k8s-succeeded/10 border border-k8s-succeeded/20">
            <Network className="h-5 w-5 text-k8s-succeeded" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Services Kubernetes</h2>
            <p className="text-xs text-muted-foreground">
              {stats.total} services · {stats.lb} LoadBalancer · {stats.np} NodePort · {stats.cip} ClusterIP
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-sm">Tous les services</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un service..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 w-64"
                />
              </div>
              <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
                <SelectTrigger className="h-8 w-48">
                  <Filter className="h-3.5 w-3.5 mr-2 shrink-0" />
                  <SelectValue placeholder="Namespace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les namespaces</SelectItem>
                  {namespaces.map((ns) => (
                    <SelectItem key={ns} value={ns}>
                      {ns}
                    </SelectItem>
                  ))}
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
              <Network className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">Aucun service</h3>
              <p className="text-muted-foreground text-sm">Aucun service ne correspond à vos critères</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>ClusterIP</TableHead>
                  <TableHead>Ports</TableHead>
                  <TableHead>Sélecteur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Âge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((svc) => (
                  <TableRow key={`${svc.namespace}/${svc.name}`}>
                    <TableCell>
                      <div>
                        <span className="font-mono text-xs font-medium">{svc.name}</span>
                        <p className="text-[10px] text-muted-foreground font-mono">{svc.namespace}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-medium',
                          TYPE_COLORS[svc.type],
                        )}
                      >
                        {svc.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {svc.clusterIP}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatPorts(svc.ports)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(svc.selector).map(([k, v]) => (
                          <span
                            key={k}
                            className="inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                          >
                            {k}={v}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-medium',
                          svc.status === 'Active'
                            ? 'bg-k8s-running/20 text-k8s-running border-k8s-running/30'
                            : 'bg-k8s-pending/20 text-k8s-pending border-k8s-pending/30',
                        )}
                      >
                        {svc.status === 'Active' ? 'Actif' : 'En attente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatAge(svc.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

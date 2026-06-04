import { useState, useMemo } from 'react';
import { Box, Search, Filter } from 'lucide-react';
import { K8sContextBar } from '@/components/k8s/K8sContextBar';
import { PodTooltip } from '@/components/k8s/PodTooltip';
import { PodLogDrawer } from '@/components/k8s/PodLogDrawer';
import { useAllK8sPods } from '@/hooks/useAllK8sPods';
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
import type { K8sPod, K8sPodPhase } from '@kubernal/shared-types';

const STATUS_LABELS: Record<K8sPodPhase, string> = {
  Running: 'En cours',
  Pending: 'En attente',
  Failed: 'Échoué',
  CrashLoopBackOff: 'CrashLoop',
  Succeeded: 'Réussi',
  Unknown: 'Inconnu',
};

const STATUS_PILLS: Record<K8sPodPhase, string> = {
  Running: 'bg-k8s-running/20 text-k8s-running border-k8s-running/30',
  Pending: 'bg-k8s-pending/20 text-k8s-pending border-k8s-pending/30',
  Failed: 'bg-k8s-failed/20 text-k8s-failed border-k8s-failed/30',
  CrashLoopBackOff: 'bg-k8s-failed/20 text-k8s-failed border-k8s-failed/30',
  Succeeded: 'bg-k8s-succeeded/20 text-k8s-succeeded border-k8s-succeeded/30',
  Unknown: 'bg-k8s-unknown/20 text-k8s-unknown border-k8s-unknown/30',
};

export default function K8sPodsPage() {
  const { data: pods = [], isLoading } = useAllK8sPods();
  const [search, setSearch] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');
  const [selectedPod, setSelectedPod] = useState<K8sPod | null>(null);

  const namespaces = useMemo(
    () => Array.from(new Set(pods.map((p) => p.namespace))).sort(),
    [pods],
  );

  const filtered = useMemo(() => {
    return pods.filter((p) => {
      const matchNs = namespaceFilter === 'all' || p.namespace === namespaceFilter;
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.namespace.toLowerCase().includes(search.toLowerCase()) ||
        p.nodeName.toLowerCase().includes(search.toLowerCase());
      return matchNs && matchSearch;
    });
  }, [pods, search, namespaceFilter]);

  const stats = useMemo(() => {
    const running = pods.filter((p) => p.status === 'Running').length;
    const pending = pods.filter((p) => p.status === 'Pending').length;
    const failed = pods.filter((p) => p.status === 'Failed' || p.status === 'CrashLoopBackOff').length;
    return { total: pods.length, running, pending, failed };
  }, [pods]);

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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-k8s-running/10 border border-k8s-running/20">
            <Box className="h-5 w-5 text-k8s-running" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Pods Kubernetes</h2>
            <p className="text-xs text-muted-foreground">
              {stats.total} pods · {stats.running} en cours · {stats.pending} en attente · {stats.failed} échoués
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-sm">Tous les pods</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un pod..."
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
              <Box className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">Aucun pod</h3>
              <p className="text-muted-foreground text-sm">Aucun pod ne correspond à vos critères</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-center">Redémarrages</TableHead>
                  <TableHead>Noeud</TableHead>
                  <TableHead>Âge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((pod) => (
                  <PodTooltip key={pod.id} pod={pod}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setSelectedPod(pod)}
                    >
                      <TableCell className="font-mono text-xs">{pod.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {pod.namespace}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-medium',
                            STATUS_PILLS[pod.status] ?? STATUS_PILLS.Unknown,
                          )}
                        >
                          {STATUS_LABELS[pod.status] ?? pod.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            'text-xs font-mono',
                            pod.restarts > 3 && 'text-k8s-failed font-semibold',
                          )}
                        >
                          {pod.restarts}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {pod.nodeName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{pod.age}</TableCell>
                    </TableRow>
                  </PodTooltip>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PodLogDrawer pod={selectedPod} onClose={() => setSelectedPod(null)} />
    </div>
  );
}

import { useState, useEffect, useRef, useMemo, type JSX } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import {
  Search,
  AlertCircle,
  Info,
  AlertTriangle,
  Activity,
  Cpu,
  MemoryStick,
  RefreshCw,
  FileText,
  Server,
  Box,
  ChevronDown,
} from 'lucide-react';
import { useClusterInfo } from '@/hooks/useClusterInfo';
import { useAllK8sPods } from '@/hooks/useAllK8sPods';
import { useAllHPA } from '@/hooks/useAllHPA';
import { useK8sEvents } from '@/hooks/useK8sEvents';
import { usePodLogs, type TransportMode } from '@/hooks/usePodLogs';
import type { K8sEvent } from '@kubernal/shared-types';

const MAX_HISTORY = 20;

interface Snapshot {
  cpu: number;
  memory: number;
  podsRunning: number;
  eventsWarning: number;
  podsReadyRatio: number;
}

function computeSnapshot(
  hpaData: { cpuCurrent: number | null; memoryCurrent: number | null }[] | undefined,
  podsData: { status: string; ready: string }[] | undefined,
  eventsData: K8sEvent[] | undefined,
): Snapshot {
  const hpas = hpaData ?? [];
  const cpuValues = hpas.map((h) => h.cpuCurrent).filter((v): v is number => v !== null);
  const memValues = hpas.map((h) => h.memoryCurrent).filter((v): v is number => v !== null);

  const pods = podsData ?? [];
  const podsRunning = pods.filter((p) => p.status === 'Running').length;
  const readyN = pods.reduce((sum, p) => {
    const [a, b] = p.ready.split('/').map(Number);
    return sum + (a ?? 0) / (b || 1);
  }, 0);
  const podsReadyRatio = pods.length > 0 ? (readyN / pods.length) * 100 : 100;

  const events = eventsData ?? [];
  const eventsWarning = events.filter((e) => e.type === 'Warning').length;

  return {
    cpu: cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : 0,
    memory: memValues.length > 0 ? memValues.reduce((a, b) => a + b, 0) / memValues.length : 0,
    podsRunning,
    eventsWarning,
    podsReadyRatio,
  };
}

const levelIcons = { info: Info, warn: AlertTriangle, error: AlertCircle } as const;
const levelColors = {
  info: 'text-status-info',
  warn: 'text-status-warning',
  error: 'text-status-error',
} as const;
const levelBadge = {
  info: 'bg-status-info/10 text-status-info border-status-info/20',
  warn: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  error: 'bg-status-error/10 text-status-error border-status-error/20',
} as const;

type TimeRange = '5 min' | '15 min' | '30 min' | '1 heure';
const timeRangeOptions: readonly TimeRange[] = ['5 min', '15 min', '30 min', '1 heure'] as const;

const transportBadge: Record<TransportMode, { label: string; color: string }> = {
  ws: { label: 'WS', color: 'text-status-success' },
  poll: { label: 'Poll', color: 'text-status-warning' },
  disconnected: { label: 'Off', color: 'text-muted-foreground' },
};

export default function Observability(): JSX.Element {
  const clusterInfo = useClusterInfo();
  const allPods = useAllK8sPods();
  const allHPA = useAllHPA();
  const events = useK8sEvents();

  const [timeRange, setTimeRange] = useState<TimeRange>('15 min');
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'Normal' | 'Warning' | null>(null);
  const [selectedPodNs, setSelectedPodNs] = useState('');
  const [selectedPodName, setSelectedPodName] = useState('');
  const [podDropdownOpen, setPodDropdownOpen] = useState(false);

  const podLogs = usePodLogs(selectedPodName, selectedPodNs, {
    enabled: !!selectedPodName && !!selectedPodNs,
    tailLines: 200,
  });

  const [history, setHistory] = useState<Snapshot[]>(() => {
    const initial = computeSnapshot(undefined, undefined, undefined);
    return Array.from({ length: MAX_HISTORY }, () => initial);
  });

  const snapshot = useMemo(
    () => computeSnapshot(allHPA.data, allPods.data, events.data),
    [allHPA.data, allPods.data, events.data],
  );

  const lastSnapshotRef = useRef(snapshot);
  useEffect(() => {
    if (paused) return;
    const prev = lastSnapshotRef.current;
    const next = snapshot;
    if (
      prev.cpu !== next.cpu ||
      prev.memory !== next.memory ||
      prev.podsRunning !== next.podsRunning ||
      prev.eventsWarning !== next.eventsWarning ||
      prev.podsReadyRatio !== next.podsReadyRatio
    ) {
      lastSnapshotRef.current = next;
      setHistory((h) => [...h.slice(1), next]);
    }
  }, [snapshot, paused]);

  const uptime =
    history.length > 0
      ? (history.reduce((s, h) => s + h.podsReadyRatio, 0) / history.length).toFixed(2)
      : '100.00';

  const maxCpu = history.length > 0 ? Math.round(Math.max(...history.map((h) => h.cpu))) : 0;
  const maxMem = history.length > 0 ? Math.round(Math.max(...history.map((h) => h.memory))) : 0;
  const warnCount = events.data?.filter((e) => e.type === 'Warning').length ?? 0;

  const pods = allPods.data ?? [];
  const podsRunning = pods.filter((p) => p.status === 'Running').length;
  const podsPending = pods.filter((p) => p.status === 'Pending').length;
  const podsFailed = pods.filter(
    (p) => p.status === 'Failed' || p.status === 'CrashLoopBackOff',
  ).length;
  const nodeCount = clusterInfo.data?.nodeCount ?? 0;
  const clusterName = clusterInfo.data?.name ?? '—';
  const k8sVersion = clusterInfo.data?.version ?? '—';

  const metricCards = [
    {
      label: 'Pods',
      value: `${podsRunning}/${pods.length}`,
      sub:
        podsFailed > 0
          ? `${podsFailed} échoués`
          : podsPending > 0
            ? `${podsPending} en attente`
            : undefined,
      color:
        podsFailed > 0
          ? 'text-status-error'
          : podsPending > 0
            ? 'text-status-warning'
            : 'text-status-success',
      icon: Box,
      dataKey: 'podsRunning' as const,
    },
    {
      label: 'Nœuds',
      value: String(nodeCount),
      sub: `${clusterName} v${k8sVersion}`,
      color: 'text-category-compliance',
      icon: Server,
      dataKey: null,
    },
    {
      label: 'CPU (HPA)',
      value: snapshot.cpu > 0 ? `${Math.round(snapshot.cpu)}%` : 'N/A',
      color:
        snapshot.cpu > 80
          ? 'text-status-error'
          : snapshot.cpu > 60
            ? 'text-status-warning'
            : 'text-status-info',
      icon: Cpu,
      dataKey: 'cpu' as const,
    },
    {
      label: 'Mémoire (HPA)',
      value: snapshot.memory > 0 ? `${Math.round(snapshot.memory)}%` : 'N/A',
      color:
        snapshot.memory > 80
          ? 'text-status-error'
          : snapshot.memory > 60
            ? 'text-status-warning'
            : 'text-status-info',
      icon: MemoryStick,
      dataKey: 'memory' as const,
    },
    {
      label: 'Événements',
      value: String(events.data?.length ?? 0),
      sub: warnCount > 0 ? `${warnCount} warnings` : undefined,
      color: warnCount > 0 ? 'text-status-warning' : 'text-status-success',
      icon: AlertTriangle,
      dataKey: 'eventsWarning' as const,
    },
    {
      label: 'Uptime',
      value: `${uptime}%`,
      sub: 'Ratio pods prêts',
      color: parseFloat(uptime) < 99 ? 'text-status-error' : 'text-status-success',
      icon: Activity,
      dataKey: null,
    },
  ];

  const chartColor = (dataKey: string | null): string => {
    if (dataKey === 'cpu' || dataKey === 'memory') return 'var(--color-category-compliance)';
    if (dataKey === 'eventsWarning') return 'var(--color-status-warning)';
    if (dataKey === 'podsRunning') return 'var(--color-status-success)';
    return 'var(--color-status-info)';
  };

  const filteredEvents = useMemo(() => {
    const items = events.data ?? [];
    return items.filter((e) => {
      if (levelFilter && e.type !== levelFilter) return false;
      if (
        search &&
        !e.message.toLowerCase().includes(search.toLowerCase()) &&
        !e.reason.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [events.data, levelFilter, search]);

  const logLines = podLogs.lines;
  const filteredPodLogs = useMemo(() => {
    if (!search) return logLines;
    const q = search.toLowerCase();
    return logLines.filter((l) => l.toLowerCase().includes(q));
  }, [logLines, search]);

  const showPodLogs = !!selectedPodName;
  const transportInfo = showPodLogs ? transportBadge[podLogs.transport] : null;

  const podsForDropdown = useMemo(
    () => pods.map((p) => ({ name: p.name, namespace: p.namespace, status: p.status })),
    [pods],
  );

  const clearPodSelection = (): void => {
    setSelectedPodName('');
    setSelectedPodNs('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Observabilité</h2>
          <p className="text-muted-foreground">
            {showPodLogs
              ? `Logs en direct — ${selectedPodName}`
              : 'Métriques cluster et événements Kubernetes.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {timeRangeOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setTimeRange(opt)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  timeRange === opt
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${paused ? 'bg-muted-foreground' : 'bg-status-success'}`}
            />
            <span className="text-xs text-muted-foreground">
              {paused ? 'En pause' : 'En direct'}
            </span>
            <button
              onClick={() => setPaused(!paused)}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {paused ? 'Reprendre' : 'Pause'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {metricCards.map((card) => {
          const Icon = card.icon;
          const color = chartColor(card.dataKey);
          return (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  {card.label}
                </CardTitle>
                <div className={`text-xs font-mono ${card.color}`}>{card.value}</div>
              </CardHeader>
              <CardContent className="pb-3">
                {card.sub && <p className="text-xs text-muted-foreground mb-2">{card.sub}</p>}
                {card.dataKey && (
                  <div className="h-16 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id={`grad-${card.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey={card.dataKey}
                          stroke={color}
                          fill={`url(#grad-${card.dataKey})`}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4 text-status-success" />
          <span>Uptime</span>
          <span className="font-mono font-medium text-status-success">{uptime}%</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Warnings : <span className="font-mono text-status-warning">{warnCount}</span>
          </span>
          <span>
            CPU max : <span className="font-mono">{maxCpu}%</span>
          </span>
          <span>
            Mem max : <span className="font-mono">{maxMem}%</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={showPodLogs ? 'Filtrer les logs...' : 'Filtrer les événements...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {!showPodLogs && (
          <div className="flex gap-1">
            {(['Normal', 'Warning'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(levelFilter === lvl ? null : lvl)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  levelFilter === lvl
                    ? `${levelBadge[lvl === 'Normal' ? 'info' : 'warn']} ring-1`
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lvl === 'Normal' ? 'Normal' : 'Warning'}
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <button
            onClick={() => setPodDropdownOpen(!podDropdownOpen)}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPodLogs ? (
              <span className="truncate max-w-35">{selectedPodName}</span>
            ) : (
              'Sélectionner un pod'
            )}
            <ChevronDown className="h-3 w-3" />
          </button>
          {podDropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-72 max-h-64 overflow-auto rounded-lg border border-border bg-card shadow-lg">
              <button
                onClick={() => {
                  clearPodSelection();
                  setPodDropdownOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Événements K8s (par défaut)
              </button>
              {podsForDropdown.map((p) => (
                <button
                  key={`${p.namespace}/${p.name}`}
                  onClick={() => {
                    setSelectedPodNs(p.namespace);
                    setSelectedPodName(p.name);
                    setPodDropdownOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors ${
                    p.name === selectedPodName ? 'bg-muted text-foreground' : 'text-foreground'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      p.status === 'Running'
                        ? 'bg-status-success'
                        : p.status === 'Pending'
                          ? 'bg-status-warning'
                          : 'bg-status-error'
                    }`}
                  />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto text-muted-foreground">{p.namespace}</span>
                </button>
              ))}
              {podsForDropdown.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Aucun pod trouvé</p>
              )}
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {showPodLogs ? (
            <>
              {podLogs.isLoading && logLines.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
                  <RefreshCw className="h-8 w-8 text-muted-foreground mb-4 animate-spin" />
                  <p className="text-muted-foreground text-sm">Connexion au pod...</p>
                </div>
              ) : filteredPodLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-1">Aucun log</h3>
                  <p className="text-muted-foreground text-sm">
                    Aucun log ne correspond à vos filtres
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-125 overflow-auto">
                  {filteredPodLogs.map((line, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-4 py-1 text-xs font-mono hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-foreground/90 whitespace-pre-wrap break-all">
                        {line}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  {transportInfo && (
                    <span className={`font-mono font-medium ${transportInfo.color}`}>
                      {transportInfo.label}
                    </span>
                  )}
                  <span>{logLines.length} lignes</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => podLogs.setFollow(!podLogs.isFollowing)}
                    className="text-primary hover:text-primary/80"
                  >
                    {podLogs.isFollowing ? 'Pause' : 'Follow'}
                  </button>
                  <button onClick={podLogs.clear} className="hover:text-foreground">
                    Effacer
                  </button>
                  <button onClick={clearPodSelection} className="hover:text-foreground">
                    Fermer
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {events.isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
                  <RefreshCw className="h-8 w-8 text-muted-foreground mb-4 animate-spin" />
                  <p className="text-muted-foreground text-sm">Chargement des événements...</p>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-1">Aucun événement</h3>
                  <p className="text-muted-foreground text-sm">
                    Aucun événement ne correspond à vos filtres
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-125 overflow-auto">
                  {filteredEvents.map((evt) => {
                    const Icon = levelIcons[evt.type === 'Warning' ? 'warn' : 'info'];
                    return (
                      <div
                        key={evt.id}
                        className="flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors font-mono"
                      >
                        <Icon
                          className={`mt-0.5 h-4 w-4 shrink-0 ${levelColors[evt.type === 'Warning' ? 'warn' : 'info']}`}
                        />
                        <span className="shrink-0 text-muted-foreground">
                          {new Date(evt.lastTimestamp).toLocaleTimeString('fr-FR')}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          [{evt.involvedObject}]
                        </span>
                        <span className="shrink-0 font-medium text-foreground">{evt.reason}</span>
                        <span className="text-foreground/90 truncate">{evt.message}</span>
                        {evt.count > 1 && (
                          <span className="shrink-0 text-muted-foreground">×{evt.count}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

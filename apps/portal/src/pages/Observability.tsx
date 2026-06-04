import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Search, AlertCircle, Info, AlertTriangle, Activity, Cpu, MemoryStick, Timer, RefreshCw, FileText } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
}

const sources = ['api-gateway', 'auth-service', 'deploy-controller', 'scheduler', 'monitoring'];

const messages: Record<string, string[]> = {
  'api-gateway': [
    'Requête entrante GET /api/applications',
    'Requête entrante POST /api/deployments',
    'Réponse 200 OK en 245ms',
    'Rate limit atteint pour l\'IP 10.0.1.45',
    'Certificat SSL renouvelé avec succès',
  ],
  'auth-service': [
    'Token JWT vérifié pour user@kubernal.io',
    'Nouvelle session créée pour admin',
    'Échec d\'authentification pour 192.168.1.100',
    'Permissions mises à jour pour le rôle developer',
    'Token d\'API régénéré',
  ],
  'deploy-controller': [
    'Déploiement #42 démarré pour payment-api',
    'Image Docker téléchargée: payment-api:v2.1.0',
    'Health check passé pour pod payment-api-7f8b9',
    'Déploiement #42 terminé avec succès',
    'Rollback déclenché pour user-service (état dégradé)',
  ],
  scheduler: [
    'Tâche cron "daily-backup" exécutée',
    'Nettoyage des pods terminés effectué',
    'Scan de sécurité planifié à 03:00',
    'Mise à jour des métriques cluster',
    'Aucune action requise - vérification routine OK',
  ],
  monitoring: [
    'Utilisation CPU: 42% (seuil: 80%)',
    'Mémoire: 3.2GB/8GB utilisée',
    'Latence p95: 320ms',
    'Alerte: Taux d\'erreur > 5% sur payment-api',
    'Uptime: 99.97% sur les 7 derniers jours',
  ],
};

function generateLogs(): LogEntry[] {
  const logs: LogEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < 30; i++) {
    const source = sources[Math.floor(Math.random() * sources.length)];
    const msgs = messages[source];
    const levelRoll = Math.random();
    const level = levelRoll > 0.9 ? 'error' : levelRoll > 0.7 ? 'warn' : 'info';

    logs.push({
      id: `log-${i}`,
      timestamp: new Date(now - i * 45000).toISOString(),
      level,
      source,
      message: msgs[Math.floor(Math.random() * msgs.length)],
    });
  }

  return logs;
}

const levelIcons = {
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
};

const levelColors = {
  info: 'text-blue-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

const levelBadge = {
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  warn: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
};

interface MetricSnapshot {
  errorRate: number;
  requestsPerMin: number;
  latency: number;
  cpu: number;
  memory: number;
  activeDeployments: number;
}

interface MetricsState {
  current: MetricSnapshot;
  history: MetricSnapshot[];
  uptimeEvents: number;
  uptimeTotal: number;
}

function generateSnapshot(prev?: MetricSnapshot): MetricSnapshot {
  return {
    errorRate: Math.max(0, Math.min(15, (prev?.errorRate ?? 2.3) + (Math.random() - 0.5) * 1.5)),
    requestsPerMin: Math.round(Math.max(500, (prev?.requestsPerMin ?? 1247) + (Math.random() - 0.5) * 200)),
    latency: Math.max(50, Math.min(2000, (prev?.latency ?? 320) + (Math.random() - 0.5) * 100)),
    cpu: Math.max(0, Math.min(100, (prev?.cpu ?? 42) + (Math.random() - 0.5) * 10)),
    memory: Math.max(0, Math.min(100, (prev?.memory ?? 55) + (Math.random() - 0.5) * 8)),
    activeDeployments: Math.round(Math.max(0, (prev?.activeDeployments ?? 12) + (Math.random() - 0.5) * 4)),
  };
}

const timeRangeOptions = ['5 min', '15 min', '30 min', '1 heure'] as const;
type TimeRange = (typeof timeRangeOptions)[number];

export default function Observability() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('15 min');
  const [metrics, setMetrics] = useState<MetricsState>(() => {
    const initial = generateSnapshot();
    const history = Array.from({ length: 20 }, () => generateSnapshot(initial));
    return { current: initial, history, uptimeEvents: 0, uptimeTotal: 0 };
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLogs(generateLogs());
  }, []);

  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(() => {
      const source = sources[Math.floor(Math.random() * sources.length)];
      const msgs = messages[source];
      const levelRoll = Math.random();
      const level = levelRoll > 0.9 ? 'error' : levelRoll > 0.7 ? 'warn' : 'info';

      setLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level,
          source,
          message: msgs[Math.floor(Math.random() * msgs.length)],
        },
        ...prev.slice(0, 99),
      ]);

      setMetrics((prev) => {
        const updatedHistory = [...prev.history.slice(1), prev.current];
        const current = generateSnapshot(prev.current);
        const isUp = current.errorRate < 5;
        return {
          current,
          history: updatedHistory,
          uptimeEvents: prev.uptimeEvents + 1,
          uptimeTotal: prev.uptimeTotal + (isUp ? 1 : 0),
        };
      });
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused]);

  const uptime = metrics.uptimeEvents > 0
    ? ((metrics.uptimeTotal / metrics.uptimeEvents) * 100).toFixed(2)
    : '100.00';

  const filtered = logs.filter((log) => {
    if (levelFilter && log.level !== levelFilter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const metricCards = [
    {
      label: "Taux d'erreur",
      value: `${metrics.current.errorRate.toFixed(1)}%`,
      color: metrics.current.errorRate > 8 ? 'text-red-400' : metrics.current.errorRate > 4 ? 'text-amber-400' : 'text-emerald-400',
      icon: AlertCircle,
      dataKey: 'errorRate' as const,
      unit: '%',
    },
    {
      label: 'Requêtes / min',
      value: metrics.current.requestsPerMin.toLocaleString('fr-FR'),
      color: 'text-accent',
      icon: Activity,
      dataKey: 'requestsPerMin' as const,
      unit: '',
    },
    {
      label: 'Latence p95',
      value: `${Math.round(metrics.current.latency)}ms`,
      color: metrics.current.latency > 800 ? 'text-red-400' : metrics.current.latency > 400 ? 'text-amber-400' : 'text-blue-400',
      icon: Timer,
      dataKey: 'latency' as const,
      unit: 'ms',
    },
    {
      label: 'CPU',
      value: `${Math.round(metrics.current.cpu)}%`,
      color: metrics.current.cpu > 80 ? 'text-red-400' : metrics.current.cpu > 60 ? 'text-amber-400' : 'text-blue-400',
      icon: Cpu,
      dataKey: 'cpu' as const,
      unit: '%',
    },
    {
      label: 'Mémoire',
      value: `${Math.round(metrics.current.memory)}%`,
      color: metrics.current.memory > 80 ? 'text-red-400' : metrics.current.memory > 60 ? 'text-amber-400' : 'text-blue-400',
      icon: MemoryStick,
      dataKey: 'memory' as const,
      unit: '%',
    },
    {
      label: 'Déploiements actifs',
      value: String(metrics.current.activeDeployments),
      color: 'text-category-compliance',
      icon: RefreshCw,
      dataKey: 'activeDeployments' as const,
      unit: '',
    },
  ];

  const chartColor = (dataKey: string) => {
    if (dataKey === 'errorRate') return '#ef4444';
    if (dataKey === 'cpu' || dataKey === 'memory') return '#8b5cf6';
    if (dataKey === 'latency') return '#f59e0b';
    if (dataKey === 'activeDeployments') return '#a78bfa';
    return '#3b82f6';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Observabilité</h2>
          <p className="text-muted-foreground">
            Logs en direct et métriques de la plateforme.
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
            <div className={`h-2 w-2 rounded-full ${paused ? 'bg-muted-foreground' : 'bg-emerald-400'}`} />
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
            <Card key={card.dataKey}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  {card.label}
                </CardTitle>
                <div className={`text-xs font-mono ${card.color}`}>
                  {card.unit && !['%', 'ms'].includes(card.unit) ? `${card.value} ${card.unit}` : card.value}
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="h-16 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...metrics.history, metrics.current]}>
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
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4 text-status-success" />
          <span>Uptime (session)</span>
          <span className="font-mono font-medium text-status-success">{uptime}%</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Erreurs : <span className="font-mono text-red-400">{metrics.history.filter(m => m.errorRate > 8).length}</span></span>
          <span>CPU max : <span className="font-mono">{Math.round(Math.max(...metrics.history.map(m => m.cpu)))}%</span></span>
          <span>Latence max : <span className="font-mono">{Math.round(Math.max(...metrics.history.map(m => m.latency)))}ms</span></span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrer les logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1">
          {(['info', 'warn', 'error'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(levelFilter === lvl ? null : lvl)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                levelFilter === lvl
                  ? `${levelBadge[lvl]} ring-1`
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {lvl === 'info' ? 'Info' : lvl === 'warn' ? 'Warn' : 'Error'}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">Aucun log</h3>
              <p className="text-muted-foreground text-sm">Aucun log ne correspond à vos filtres</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((log) => {
                const Icon = levelIcons[log.level];
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors font-mono"
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${levelColors[log.level]}`} />
                    <span className="shrink-0 text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      [{log.source}]
                    </span>
                    <span className="text-foreground/90">{log.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

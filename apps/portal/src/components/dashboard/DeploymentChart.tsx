import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  BarStack,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Deployment } from '@kubernal/shared-types';

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

interface ChartData {
  day: string;
  succès: number;
  échecs: number;
}

interface DeploymentChartProps {
  deployments: Deployment[];
}

export function DeploymentChart({ deployments }: DeploymentChartProps) {
  const data = useMemo<ChartData[]>(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dayMap = new Map<string, { succès: number; échecs: number }>();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { succès: 0, échecs: 0 });
    }

    for (const dep of deployments) {
      const depDate = new Date(dep.createdAt);
      if (depDate < sevenDaysAgo) continue;
      const key = depDate.toISOString().slice(0, 10);
      const entry = dayMap.get(key);
      if (!entry) continue;
      if (dep.status === 'healthy') entry.succès++;
      else if (dep.status === 'failed') entry.échecs++;
    }

    const result: ChartData[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const entry = dayMap.get(key)!;
      result.push({ day: DAY_LABELS[d.getDay()], succès: entry.succès, échecs: entry.échecs });
    }

    return result;
  }, [deployments]);

  if (deployments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fréquence des déploiements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Aucun déploiement pour le moment
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fréquence des déploiements</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4} barCategoryGap="20%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-border/30"
              />
              <XAxis
                dataKey="day"
                className="text-xs text-muted-foreground"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                className="text-xs text-muted-foreground"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
                cursor={{ fill: 'var(--muted)' }}
              />
              <BarStack radius={[4, 4, 0, 0]}>
                <Bar dataKey="succès" fill="#22c55e" fillOpacity={1} maxBarSize={32} />
                <Bar dataKey="échecs" fill="#ef4444" fillOpacity={1} maxBarSize={32} />
              </BarStack>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

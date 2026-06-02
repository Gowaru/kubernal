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

const data = [
  { day: 'Lun', déploiements: 4, succès: 3, échecs: 1 },
  { day: 'Mar', déploiements: 7, succès: 6, échecs: 1 },
  { day: 'Mer', déploiements: 5, succès: 5, échecs: 0 },
  { day: 'Jeu', déploiements: 8, succès: 7, échecs: 1 },
  { day: 'Ven', déploiements: 6, succès: 5, échecs: 1 },
  { day: 'Sam', déploiements: 2, succès: 2, échecs: 0 },
  { day: 'Dim', déploiements: 3, succès: 3, échecs: 0 },
];

export function DeploymentChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fréquence des déploiements</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/30" />
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
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
                cursor={{ fill: 'hsl(var(--muted))' }}
              />
              <BarStack radius={[4, 4, 0, 0]}>
                <Bar
                  dataKey="succès"
                  fill="#22c55e"
                  fillOpacity={1}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="échecs"
                  fill="#ef4444"
                  fillOpacity={1}
                  maxBarSize={32}
                />
              </BarStack>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

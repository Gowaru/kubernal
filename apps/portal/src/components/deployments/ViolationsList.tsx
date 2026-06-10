import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JSX } from 'react';
import type { PolicyViolation } from '@kubernal/shared-types';

const severityConfig: Record<string, { label: string; className: string }> = {
  critical: {
    label: 'CRITICAL',
    className: 'bg-status-error/10 text-status-error border-status-error/20',
  },
  high: {
    label: 'HAUTE',
    className: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  },
  medium: {
    label: 'MOYENNE',
    className: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  },
  low: {
    label: 'BASSE',
    className: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  },
};

interface ViolationsListProps {
  violations: PolicyViolation[];
}

export function ViolationsList({ violations }: ViolationsListProps): JSX.Element | null {
  if (violations.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-status-error" />
          Violations de politique
          <Badge variant="outline" className="ml-auto">
            {violations.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {violations.map((v) => {
          const severity = severityConfig[v.severity] ?? severityConfig.low;
          return (
            <div
              key={v.id}
              className="rounded-lg border border-border p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{v.policyName}</span>
                <Badge variant="outline" className={cn('text-xs', severity.className)}>
                  {severity.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{v.message}</p>
              <p className="text-xs text-muted-foreground font-mono">
                Resource: {v.resource}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

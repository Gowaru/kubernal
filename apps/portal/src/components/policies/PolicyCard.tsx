import { type JSX } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Shield, FileCheck, DollarSign, Settings, Terminal } from 'lucide-react';
import type { SecurityPolicy, PolicyCategory, PolicySeverity } from '@kubernal/shared-types';

const severityConfig: Record<PolicySeverity, { label: string; className: string }> = {
  critical: { label: 'CRITIQUE', className: 'bg-status-error/10 text-status-error border-status-error/20' },
  high: { label: 'HAUTE', className: 'bg-status-warning/10 text-status-warning border-status-warning/20' },
  medium: { label: 'MOYENNE', className: 'bg-status-warning/10 text-status-warning border-status-warning/20' },
  low: { label: 'BASSE', className: 'bg-status-warning/10 text-status-warning border-status-warning/20' },
};

const categoryConfig: Record<PolicyCategory, { label: string; icon: typeof Shield; className: string }> = {
  security: { label: 'Sécurité', icon: Shield, className: 'bg-category-security/10 text-category-security border-category-security/20' },
  compliance: { label: 'Conformité', icon: FileCheck, className: 'bg-category-compliance/10 text-category-compliance border-category-compliance/20' },
  cost: { label: 'Coût', icon: DollarSign, className: 'bg-category-cost/10 text-category-cost border-category-cost/20' },
  operations: { label: 'Opérations', icon: Settings, className: 'bg-category-ops/10 text-category-ops border-category-ops/20' },
};

interface PolicyCardProps {
  policy: SecurityPolicy;
  onToggle: (id: string, enabled: boolean) => void;
  toggling: boolean;
}

export function PolicyCard({ policy, onToggle, toggling }: PolicyCardProps): JSX.Element {
  const severity = severityConfig[policy.severity];
  const category = categoryConfig[policy.category];
  const CategoryIcon = category.icon;

  return (
    <Card className="group transition-all duration-200 hover:border-accent/30">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <Badge variant="outline" className={cn('text-xs', severity.className)}>
            {severity.label}
          </Badge>
          <button
            onClick={() => onToggle(policy.id, !policy.enabled)}
            disabled={toggling}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              policy.enabled ? 'bg-primary' : 'bg-input',
            )}
          >
            <span
              className={cn(
                'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                policy.enabled ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
        </div>

        <h3 className="font-semibold tracking-tight group-hover:text-accent transition-colors mb-1">
          {policy.name}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {policy.description}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={cn('flex items-center gap-1 text-xs', category.className)}>
            <CategoryIcon className="h-3 w-3" />
            {category.label}
          </Badge>
          <Badge variant="outline" className="bg-secondary/50 text-muted-foreground border-border text-xs">
            <Terminal className="mr-1 h-3 w-3" />
            {policy.engine}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

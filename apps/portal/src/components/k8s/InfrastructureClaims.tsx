import { type JSX } from 'react';
import { Database, Server, Cloud, Network, Boxes } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CrossplaneClaim, CrossplaneClaimKind, CrossplaneClaimStatus } from '@kubernal/shared-types';
import type { LucideIcon } from 'lucide-react';

const kindIcons: Record<CrossplaneClaimKind, LucideIcon> = {
  Postgres: Database,
  Redis: Server,
  Bucket: Cloud,
  Network: Network,
  Custom: Boxes,
};

const statusLabels: Record<CrossplaneClaimStatus, string> = {
  Ready: 'Prêt',
  Binding: 'Binding',
  Provisioning: 'Provisionnement',
  Failed: 'Échoué',
  Deleting: 'Suppression',
};

const statusStyles: Record<CrossplaneClaimStatus, string> = {
  Ready: 'border-k8s-running/20 bg-k8s-running/5',
  Binding: 'border-k8s-pending/20 bg-k8s-pending/5',
  Provisioning: 'border-k8s-pending/20 bg-k8s-pending/5',
  Failed: 'border-k8s-failed/20 bg-k8s-failed/5',
  Deleting: 'border-k8s-terminating/20 bg-k8s-terminating/5',
};

const statusDotColors: Record<CrossplaneClaimStatus, string> = {
  Ready: 'bg-k8s-running',
  Binding: 'bg-k8s-pending animate-pulse-glow',
  Provisioning: 'bg-k8s-pending animate-pulse-glow',
  Failed: 'bg-k8s-failed',
  Deleting: 'bg-k8s-terminating',
};

interface InfrastructureClaimsProps {
  claims: CrossplaneClaim[];
}

export function InfrastructureClaims({ claims }: InfrastructureClaimsProps): JSX.Element {
  if (claims.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">Aucune claim infrastructure</p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {claims.map((claim, i) => {
        const Icon = kindIcons[claim.kind] ?? Boxes;
        return (
          <motion.div
            key={claim.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className={cn(
              'relative flex flex-col gap-2 rounded-lg border p-3',
              statusStyles[claim.status],
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{claim.kind}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', statusDotColors[claim.status])} />
                <span className="text-[10px] font-medium">{statusLabels[claim.status]}</span>
              </div>
            </div>

            <span className="font-mono text-sm truncate">{claim.name}</span>
            <span className="text-xs text-muted-foreground">{claim.class}</span>

            {claim.endpoint && (
              <span className="font-mono text-xs text-muted-foreground truncate">
                {claim.endpoint}
              </span>
            )}

            {claim.message && (
              <span className="text-xs text-k8s-pending">{claim.message}</span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

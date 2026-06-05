import { type JSX } from 'react';
import { Server, Box, GitBranch } from 'lucide-react';
import { motion } from 'framer-motion';
import type { K8sClusterContext } from '@kubernal/shared-types';

interface K8sContextBarProps {
  cluster: K8sClusterContext;
  namespace: string;
  branch: string;
  revision: string;
}

export function K8sContextBar({ cluster, namespace, branch, revision }: K8sContextBarProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex items-center gap-4 px-4 py-2.5 bg-secondary/50 rounded-lg border border-border"
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-k8s-running shrink-0" />
        <Server className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{cluster.name}</span>
      </div>

      <span className="text-muted-foreground/40">·</span>

      <div className="flex items-center gap-2">
        <Box className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-mono">{namespace}</span>
      </div>

      <span className="text-muted-foreground/40">·</span>

      <div className="flex items-center gap-2">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{branch}</span>
        <span className="font-mono text-xs text-muted-foreground">@</span>
        <span className="font-mono text-xs text-muted-foreground">{revision.slice(0, 7)}</span>
      </div>

      <div className="flex-1" />

      <span className="text-[10px] font-mono text-muted-foreground/50">v{cluster.version}</span>
    </motion.div>
  );
}

import { GitBranch, Package, RefreshCw, Rocket, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { DeploymentStatus, ArgoAppStatus } from '@kubernal/shared-types';
import type { LucideIcon } from 'lucide-react';

type StepStatus = 'done' | 'running' | 'failed' | 'pending';

interface Step {
  label: string;
  icon: LucideIcon;
  status: StepStatus;
}

function computeSteps(deploymentStatus: DeploymentStatus, argoStatus: ArgoAppStatus): Step[] {
  const steps: Step[] = [
    { label: 'Push Git', icon: GitBranch, status: 'pending' },
    { label: 'Build Image', icon: Package, status: 'pending' },
    { label: 'Sync Argo CD', icon: RefreshCw, status: 'pending' },
    { label: 'Rollout K8s', icon: Rocket, status: 'pending' },
    { label: 'Sain', icon: Heart, status: 'pending' },
  ];

  const isActive = ['building', 'deploying', 'healthy'].includes(deploymentStatus);
  const isHealthy = deploymentStatus === 'healthy';
  const isFailed = deploymentStatus === 'failed';
  const isRolledBack = deploymentStatus === 'rolled_back';

  if (isHealthy) {
    steps.forEach((s) => (s.status = 'done'));
    return steps;
  }

  if (isFailed) {
    steps[0].status = 'done';
    steps[1].status = 'done';
    steps[2].status = argoStatus.sync === 'Synced' ? 'done' : 'failed';
    steps[3].status = steps[2].status === 'done' ? 'failed' : 'pending';
    return steps;
  }

  if (isRolledBack) {
    steps[0].status = 'done';
    steps[1].status = 'done';
    steps[2].status = 'done';
    steps[3].status = 'failed';
    return steps;
  }

  if (isActive || deploymentStatus === 'pending') {
    const progress = deploymentStatus === 'pending' ? 0 : deploymentStatus === 'building' ? 1 : 3;
    for (let i = 0; i < progress; i++) {
      steps[i].status = 'done';
    }
    if (progress < steps.length) {
      steps[progress].status = 'running';
    }
  }

  return steps;
}

const statusStyles: Record<StepStatus, string> = {
  done: 'bg-k8s-running/20 text-k8s-running border-k8s-running/30',
  running: 'bg-k8s-succeeded/20 text-k8s-succeeded border-k8s-succeeded/30',
  failed: 'bg-k8s-failed/20 text-k8s-failed border-k8s-failed/30',
  pending: 'bg-secondary text-muted-foreground border-border',
};

function lineColor(left: StepStatus, right: StepStatus): string {
  if (left === 'done' && right === 'done') return 'bg-k8s-running/40';
  if (left === 'done' && right === 'running') return 'bg-k8s-succeeded/40';
  if (left === 'failed' || right === 'failed') return 'bg-k8s-failed/30';
  return 'bg-border';
}

interface GitOpsPipelineProps {
  deploymentStatus: DeploymentStatus;
  argoStatus: ArgoAppStatus;
}

export function GitOpsPipeline({ deploymentStatus, argoStatus }: GitOpsPipelineProps) {
  const steps = computeSteps(deploymentStatus, argoStatus);

  return (
    <div className="flex items-center w-full">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <div key={step.label} className="flex items-center flex-1 last:flex-initial">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                  statusStyles[step.status],
                  step.status === 'running' && 'animate-pulse-glow',
                  step.status === 'failed' && 'animate-blink-alert',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    step.status === 'running' && step.icon === RefreshCw && 'animate-spin',
                  )}
                />
              </div>
              <span className="text-[10px] font-medium whitespace-nowrap">{step.label}</span>
            </motion.div>
            {i < steps.length - 1 && (
              <div
                className={cn('h-0.5 flex-1 mx-1', lineColor(step.status, steps[i + 1].status))}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

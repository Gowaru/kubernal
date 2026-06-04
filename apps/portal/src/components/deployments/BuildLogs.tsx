import { useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { DeploymentStatus } from '@kubernal/shared-types';

const LOG_DATA: Record<string, string[]> = {
  building: [
    '[14:32:01] → Build started',
    '[14:32:01] $ git clone https://github.com/org/repo.git',
    '[14:32:03] ✓ Repository cloned',
    '[14:32:04] $ npm ci --frozen-lockfile',
    '[14:32:09] ✓ Dependencies installed',
    '[14:32:09] $ npm run build',
    '[14:32:15] › Building application...',
    '[14:32:18] ✓ Build successful (12.3s)',
    '[14:32:18] $ docker build -t app:latest .',
    '[14:32:22] › Building Docker image...',
    '[14:32:24] ✓ Image built (6.2s)',
    '[14:32:24] $ docker push registry.io/app:latest',
  ],
  deploying: [
    '[14:32:01] → Build started',
    '[14:32:01] $ git clone https://github.com/org/repo.git',
    '[14:32:03] ✓ Repository cloned',
    '[14:32:04] $ npm ci --frozen-lockfile',
    '[14:32:09] ✓ Dependencies installed',
    '[14:32:09] $ npm run build',
    '[14:32:18] ✓ Build successful (12.3s)',
    '[14:32:18] $ docker build -t app:latest .',
    '[14:32:24] ✓ Image built',
    '[14:32:24] $ docker push registry.io/app:latest',
    '[14:32:28] ✓ Image pushed',
    '[14:32:28] → Deploy started',
    '[14:32:28] $ kubectl set image deployment/app app=app:latest',
    '[14:32:32] › Updating deployment...',
    '[14:32:35] › Waiting for rollout...',
  ],
  healthy: [
    '[14:32:01] → Build started',
    '[14:32:01] $ git clone https://github.com/org/repo.git',
    '[14:32:03] ✓ Repository cloned',
    '[14:32:04] $ npm ci --frozen-lockfile',
    '[14:32:09] ✓ Dependencies installed',
    '[14:32:09] $ npm run build',
    '[14:32:18] ✓ Build successful (12.3s)',
    '[14:32:18] $ docker build -t app:latest .',
    '[14:32:24] ✓ Docker image built (6.2s)',
    '[14:32:24] $ docker push registry.io/app:latest',
    '[14:32:28] ✓ Image pushed (4.1s)',
    '[14:32:28] → Deploy started',
    '[14:32:28] $ kubectl set image deployment/app app=app:latest',
    '[14:32:35] ✓ Deployment updated',
    '[14:32:35] $ kubectl rollout status deployment/app',
    '[14:32:38] ✓ Rollout complete (3.3s)',
    '[14:32:38] → Health checks',
    '[14:32:38] $ curl --retry 3 http://app/healthz',
    '[14:32:39] ✓ Health check passed (200 OK)',
    '[14:32:39] ✓ Deployment completed successfully',
  ],
  failed: [
    '[14:32:01] → Build started',
    '[14:32:01] $ git clone https://github.com/org/repo.git',
    '[14:32:03] ✓ Repository cloned',
    '[14:32:04] $ npm ci --frozen-lockfile',
    '[14:32:09] ✓ Dependencies installed',
    '[14:32:09] $ npm run build',
    '[14:32:18] ✓ Build successful (12.3s)',
    '[14:32:18] $ docker build -t app:latest .',
    '[14:32:24] ✓ Docker image built',
    '[14:32:24] $ docker push registry.io/app:latest',
    '[14:32:28] ✓ Image pushed',
    '[14:32:28] → Deploy started',
    '[14:32:28] $ kubectl set image deployment/app app=app:latest',
    '[14:32:35] ✓ Deployment updated',
    '[14:32:35] $ kubectl rollout status deployment/app',
    '[14:32:38] ✗ Rollout failed: CrashLoopBackOff',
    '[14:32:38] $ kubectl describe pod app-7d8f9b6c',
    '[14:32:40] › Container restarting due to OOMKill',
    '[14:32:40] ✗ Deployment failed',
  ],
  rolled_back: [
    '[14:32:01] → Build started',
    '[14:32:01] $ git clone https://github.com/org/repo.git',
    '[14:32:03] ✓ Repository cloned',
    '[14:32:04] $ npm ci --frozen-lockfile',
    '[14:32:09] ✓ Dependencies installed',
    '[14:32:09] $ npm run build',
    '[14:32:18] ✓ Build successful (12.3s)',
    '[14:32:24] ✓ Docker image built',
    '[14:32:28] ✓ Image pushed',
    '[14:32:28] → Deploy started',
    '[14:32:35] ✓ Deployment updated',
    '[14:32:38] ✗ Health check failed (502 Bad Gateway)',
    '[14:32:38] → Automatic rollback triggered',
    '[14:32:38] $ kubectl rollout undo deployment/app',
    '[14:32:42] ✓ Rollback to previous version completed',
  ],
  cancelled: [
    '[14:32:01] → Build started',
    '[14:32:01] $ git clone https://github.com/org/repo.git',
    '[14:32:03] ✓ Repository cloned',
    '[14:32:04] $ npm ci --frozen-lockfile',
    '[14:32:09] ✓ Dependencies installed',
    '[14:32:09] $ npm run build',
    '[14:32:12] ⚠ Build cancelled by user',
  ],
};

interface BuildLogsProps {
  status: DeploymentStatus;
}

export function BuildLogs({ status }: BuildLogsProps) {
  const logs = useMemo(() => LOG_DATA[status] ?? LOG_DATA.building, [status]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      ref={containerRef}
      className="max-h-80 overflow-y-auto rounded-lg bg-[oklch(0.08_0.005_265)] p-4 font-mono text-xs leading-relaxed"
    >
      {status === 'pending' ? (
        <p className="text-muted-foreground italic">En attente du début du build...</p>
      ) : (
        logs.map((line, i) => {
          const isError = line.includes('✗') || line.includes('failed');
          const isSuccess = line.includes('✓');
          const isWarning = line.includes('⚠');
          const isCommand = line.startsWith('[$');
          return (
            <p
              key={i}
              className={cn(
                'whitespace-nowrap',
                isError && 'text-red-400',
                isSuccess && 'text-emerald-400',
                isWarning && 'text-amber-400',
                isCommand && 'text-blue-300',
                !isError && !isSuccess && !isWarning && !isCommand && 'text-muted-foreground',
              )}
            >
              {line}
            </p>
          );
        })
      )}
    </div>
  );
}

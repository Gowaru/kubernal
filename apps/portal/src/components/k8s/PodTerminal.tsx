import { useEffect, useCallback, type JSX } from 'react';
import { useTerminal } from '@/hooks/useTerminal';
import { Terminal as TerminalIcon, Loader2, TriangleAlert, Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PodTerminalProps {
  namespace: string;
  podName: string;
  container?: string;
  shell?: string;
  onStatusChange?: (status: string) => void;
}

export function PodTerminal({ namespace, podName, container, shell, onStatusChange }: PodTerminalProps): JSX.Element {
  const { terminalRef, status, shellEffectif, connect, disconnect, fit, clear } = useTerminal();

  useEffect(() => {
    connect(namespace, podName, { container, shell });
    return () => disconnect();
  }, [namespace, podName, container, shell]);

  useEffect(() => {
    fit();
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [status]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const handleReconnect = useCallback(() => {
    disconnect();
    connect(namespace, podName, { container, shell });
  }, [namespace, podName, container, shell, connect, disconnect]);

  const statusLabel = {
    disconnected: 'Déconnecté',
    connecting: 'Connexion…',
    connected: 'Connecté',
    fallback: 'Fallback sh',
    error: 'Erreur',
  }[status];

  const statusIcon = status === 'connecting' ? (
    <Loader2 className="h-3 w-3 animate-spin" />
  ) : status === 'fallback' ? (
    <TriangleAlert className="h-3 w-3 text-status-warning" />
  ) : null;

  return (
    <div className={cn(
      'relative rounded-lg overflow-hidden border border-border',
      status === 'connected' && 'border-k8s-running/30',
      status === 'error' && 'border-status-error/30',
    )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-terminal-bg border-b border-border">
        <div className="flex items-center gap-2 text-xs">
          <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-muted-foreground">{podName}</span>
          <span className="text-muted-foreground/50">—</span>
          <span className="font-mono text-muted-foreground/70">{shellEffectif}</span>
          <span className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
            status === 'connected' && 'bg-k8s-running/10 text-k8s-running',
            status === 'connecting' && 'bg-k8s-pending/10 text-k8s-pending',
            status === 'error' && 'bg-status-error/10 text-status-error',
            status === 'fallback' && 'bg-status-warning/10 text-status-warning',
            status === 'disconnected' && 'bg-muted text-muted-foreground',
          )}
          >
            {statusIcon}
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {status === 'connected' && (
            <button
              onClick={clear}
              className="inline-flex items-center justify-center rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-accent/10 transition-colors"
              title="Effacer"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
          )}
          {status === 'disconnected' || status === 'error' ? (
            <button
              onClick={handleReconnect}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-k8s-running hover:bg-k8s-running/10 transition-colors"
            >
              Reconnecter
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-status-error hover:bg-status-error/10 transition-colors"
            >
              Déconnecter
            </button>
          )}
        </div>
      </div>
      <div
        ref={terminalRef}
        className="h-[55vh] bg-terminal-bg p-0"
      />
    </div>
  );
}

import { useState, useEffect, useRef, useCallback, type JSX } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Eye, EyeOff, Trash2, X, Loader2, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePodLogs } from '@/hooks/usePodLogs';
import type { K8sPod } from '@kubernal/shared-types';

const STATUS_DOT: Record<string, string> = {
  Running: 'bg-k8s-running',
  Pending: 'bg-k8s-pending',
  Failed: 'bg-k8s-failed',
  Succeeded: 'bg-k8s-succeeded',
  Unknown: 'bg-k8s-unknown',
};

const LEVEL_CLASS: Record<string, string> = {
  INFO: 'text-k8s-running',
  WARN: 'text-k8s-pending',
  ERROR: 'text-k8s-failed',
  DEBUG: 'text-k8s-terminating',
};

function parseLogLevel(line: string): string {
  const match = line.match(/\d{2}:\d{2}:\d{2}\]\s+(\w+)/);
  return match ? match[1] : 'INFO';
}

interface PodLogDrawerProps {
  pod: K8sPod | null;
  onClose: () => void;
}

export function PodLogDrawer({ pod, onClose }: PodLogDrawerProps): JSX.Element {
  const [follow, setFollow] = useState(true);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { lines, isLoading, isError, transport, isFollowing, setFollow: setHookFollow, clear } = usePodLogs(
    pod?.name ?? '',
    pod?.namespace ?? '',
    { tailLines: 200, enabled: !!pod, follow },
  );

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  const handleScroll = useCallback(() => {
    setUserScrolledUp(!isNearBottom());
  }, [isNearBottom]);

  useEffect(() => {
    setFollow(true);
    setUserScrolledUp(false);
  }, [pod?.id]);

  useEffect(() => {
    if (follow && !userScrolledUp && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, follow, userScrolledUp]);

  useEffect(() => {
    if (isError && pod) {
      toast.error(`Erreur lors du chargement des logs de ${pod.name}`);
    }
  }, [isError, pod]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    if (pod) {
      document.addEventListener('keydown', handleKeyDown);
      return (): void => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [pod, onClose]);

  const handleToggleFollow = useCallback(() => {
    const next = !follow;
    setFollow(next);
    setHookFollow(next);
  }, [follow, setHookFollow]);

  const transportLabel: Record<string, string> = {
    ws: 'WebSocket',
    poll: 'Polling',
    disconnected: 'Déconnecté',
  };

  return (
    <AnimatePresence>
      {pod && (
        <>
        <div
          className="fixed inset-0 z-40 bg-overlay/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col border-t border-x border-border rounded-t-lg"
          style={{ height: '40vh' }}
        >
          <div className="flex items-center justify-between px-4 py-2 bg-secondary border-t border-x border-border rounded-t-lg">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm">{pod.name}</span>
              <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[pod.status] ?? 'bg-k8s-unknown')} />
              {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-1">
              <span
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground"
                title={transportLabel[transport]}
              >
                {transport === 'ws'
                  ? <Wifi className="h-3 w-3 text-green-500" />
                  : <WifiOff className={cn('h-3 w-3', transport === 'poll' ? 'text-amber-500' : 'text-muted-foreground')} />
                }
                {transport === 'ws' ? 'WS' : transport === 'poll' ? 'Poll' : '—'}
              </span>
              <button
                onClick={handleToggleFollow}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {isFollowing ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {isFollowing ? 'Suivre' : 'Pause'}
              </button>
              <button
                onClick={clear}
                className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto bg-background p-4 font-mono text-xs leading-5"
          >
            {lines.map((line, i) => {
              const level = parseLogLevel(line);
              return (
                <p key={i} className="text-muted-foreground">
                  <span className={cn(LEVEL_CLASS[level] ?? 'text-muted-foreground')}>
                    {line.substring(0, line.indexOf(']') + 1)}
                  </span>
                  <span>{line.substring(line.indexOf(']') + 1)}</span>
                </p>
              );
            })}
          </div>
        </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

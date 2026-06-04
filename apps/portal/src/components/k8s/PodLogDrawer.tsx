import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Eye, EyeOff, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateMockLogLine, generateMockPodLogs } from '@/mocks/k8s-data';
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

export function PodLogDrawer({ pod, onClose }: PodLogDrawerProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [follow, setFollow] = useState(true);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  const handleScroll = useCallback(() => {
    setUserScrolledUp(!isNearBottom());
  }, [isNearBottom]);

  useEffect(() => {
    if (!pod) return;
    setLogs(generateMockPodLogs(20));
    setUserScrolledUp(false);
    setFollow(true);
  }, [pod?.id]);

  useEffect(() => {
    if (!pod || !follow) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setLogs(prev => {
        const next = [...prev, generateMockLogLine()];
        return next.length > 500 ? next.slice(-500) : next;
      });
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pod, follow]);

  useEffect(() => {
    if (follow && !userScrolledUp && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, follow, userScrolledUp]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (pod) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [pod, onClose]);

  return (
    <AnimatePresence>
      {pod && (
        <>
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
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
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFollow(f => !f)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {follow ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {follow ? 'Suivre' : 'Pause'}
              </button>
              <button
                onClick={() => setLogs([])}
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
            className="flex-1 overflow-y-auto bg-[oklch(0.08_0.005_265)] p-4 font-mono text-xs leading-5"
          >
            {logs.map((line, i) => {
              const level = parseLogLevel(line);
              return (
                <p key={i} className="text-gray-300">
                  <span className={cn(LEVEL_CLASS[level] ?? 'text-gray-300')}>
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

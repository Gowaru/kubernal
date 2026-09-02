import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import type { PodLogsResult } from '@/hooks/useK8sActions';

export type TransportMode = 'ws' | 'poll' | 'disconnected';

interface UsePodLogsOptions {
  tailLines?: number;
  container?: string;
  enabled?: boolean;
  follow?: boolean;
}

interface UsePodLogsReturn {
  lines: string[];
  isLoading: boolean;
  isError: boolean;
  transport: TransportMode;
  isFollowing: boolean;
  setFollow: (follow: boolean) => void;
  clear: () => void;
}

const MAX_LINES = 500;

export function usePodLogs(
  podName: string,
  namespace: string,
  options: UsePodLogsOptions = {},
): UsePodLogsReturn {
  const { tailLines = 200, container, follow = true, enabled: optionsEnabled = true } = options;

  const [lines, setLines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [transport, setTransport] = useState<TransportMode>('disconnected');
  const [isFollowing, setIsFollowing] = useState(follow);

  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followRef = useRef(isFollowing);
  const isActive = optionsEnabled && !!podName && !!namespace;

  followRef.current = isFollowing;

  const cleanupWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
  }, []);

  const cleanupPoll = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const cleanupReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const appendLines = useCallback((newLines: string[]) => {
    setLines((prev) => {
      const next = [...prev, ...newLines];
      return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
    });
  }, []);

  const fallbackToPoll = useCallback(() => {
    if (!followRef.current) return;
    cleanupWs();
    setTransport('poll');
  }, [cleanupWs]);

  const connectWs = useCallback(() => {
    if (!isActive) return;
    cleanupWs();
    cleanupPoll();
    cleanupReconnect();

    setTransport('ws');
    setIsLoading(true);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const params = new URLSearchParams();
    if (container) params.set('container', container);
    if (tailLines) params.set('tailLines', String(tailLines));
    params.set('timestamps', 'true');
    const qs = params.toString();
    const wsUrl = `${protocol}//${host}/api/ws/kubernetes/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/logs${qs ? `?${qs}` : ''}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = (): void => {
      setIsLoading(false);
      setTransport('ws');
    };

    ws.onmessage = (event: MessageEvent): void => {
      try {
        const msg = JSON.parse(event.data) as { type: string; line?: string; message?: string };
        if (msg.type === 'log' && msg.line !== null && msg.line !== undefined) {
          appendLines([msg.line]);
        } else if (msg.type === 'error') {
          fallbackToPoll();
        } else if (msg.type === 'eof') {
          cleanupWs();
          setTransport('poll');
        }
      } catch {
        if ((event.data as string).length > 0) {
          appendLines([event.data as string]);
        }
      }
    };

    ws.onclose = (): void => {
      if (followRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (followRef.current && isActive) {
            fallbackToPoll();
          }
        }, 1000);
      } else {
        cleanupWs();
        setTransport('disconnected');
      }
    };

    ws.onerror = (): void => {
      if (followRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (followRef.current && isActive) {
            fallbackToPoll();
          }
        }, 1000);
      }
    };
  }, [
    isActive,
    namespace,
    podName,
    container,
    tailLines,
    cleanupWs,
    cleanupPoll,
    cleanupReconnect,
    appendLines,
    fallbackToPoll,
  ]);

  const startPoll = useCallback(() => {
    if (!isActive) return;
    cleanupWs();
    cleanupPoll();
    cleanupReconnect();

    setTransport('poll');
    setIsLoading(true);

    const fetchLogs = async (): Promise<void> => {
      try {
        const { data } = await apiClient.get<PodLogsResult>(
          `/kubernetes/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/logs`,
          { params: { tailLines, container } },
        );
        setLines(data.lines);
        setIsLoading(false);
        setIsError(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    };

    void fetchLogs();
    pollIntervalRef.current = setInterval(() => {
      if (!followRef.current) return;
      void fetchLogs();
    }, 3000);
  }, [
    isActive,
    namespace,
    podName,
    tailLines,
    container,
    cleanupWs,
    cleanupPoll,
    cleanupReconnect,
  ]);

  useEffect(() => {
    if (!isActive) {
      cleanupWs();
      cleanupPoll();
      cleanupReconnect();
      setLines([]);
      setIsLoading(false);
      setTransport('disconnected');
      return;
    }

    if (isFollowing) {
      connectWs();
    } else {
      cleanupWs();
      cleanupReconnect();
      startPoll();
    }

    return (): void => {
      cleanupWs();
      cleanupPoll();
      cleanupReconnect();
    };
  }, [isActive, isFollowing, podName, namespace]);

  const setFollow = useCallback((value: boolean) => {
    setIsFollowing(value);
  }, []);

  const clear = useCallback(() => {
    setLines([]);
  }, []);

  return {
    lines,
    isLoading,
    isError,
    transport,
    isFollowing,
    setFollow,
    clear,
  };
}

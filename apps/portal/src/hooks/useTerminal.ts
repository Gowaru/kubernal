import { useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { RefObject } from 'react';

export type TerminalStatus = 'disconnected' | 'connecting' | 'connected' | 'fallback' | 'error';

export type TerminalMessage =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'exit'; code: number }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string };

export interface TerminalOptions {
  container?: string;
  shell?: string;
}

export interface UseTerminalReturn {
  terminalRef: RefObject<HTMLDivElement | null>;
  isConnected: boolean;
  status: TerminalStatus;
  shellEffectif: string;
  connect: (namespace: string, podName: string, opts?: TerminalOptions) => void;
  disconnect: () => void;
  fit: () => void;
  clear: () => void;
}

export function useTerminal(): UseTerminalReturn {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<string[]>([]);

  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<TerminalStatus>('disconnected');
  const [shellEffectif, setShellEffectif] = useState('');

  const disconnect = useCallback(() => {
    setStatus('disconnected');
    setIsConnected(false);

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }

    fitRef.current = null;
    bufferRef.current = [];
  }, []);

  const connect = useCallback((namespace: string, podName: string, opts?: TerminalOptions) => {
    disconnect();

    setStatus('connecting');
    setIsConnected(false);
    setShellEffectif(opts?.shell ?? '/bin/sh');

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
      theme: {
        background: '#0B0F19',
        foreground: '#E2E8F0',
        cursor: '#4880FF',
        selectionBackground: '#4880FF33',
        black: '#1E293B',
        red: '#EF4444',
        green: '#22C55E',
        yellow: '#EAB308',
        blue: '#4880FF',
        magenta: '#A855F7',
        cyan: '#22D3EE',
        white: '#E2E8F0',
        brightBlack: '#475569',
        brightRed: '#F87171',
        brightGreen: '#4ADE80',
        brightYellow: '#FDE047',
        brightBlue: '#60A5FA',
        brightMagenta: '#C084FC',
        brightCyan: '#67E8F9',
        brightWhite: '#F8FAFC',
      },
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    xtermRef.current = term;
    fitRef.current = fitAddon;

    if (terminalRef.current) {
      terminalRef.current.innerHTML = '';
      term.open(terminalRef.current);
      setTimeout(() => fitAddon.fit(), 50);
    }

    const container = opts?.container;
    const shell = opts?.shell ?? '/bin/sh';

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws/kubernetes/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/exec?shell=${encodeURIComponent(shell)}${container ? `&container=${encodeURIComponent(container)}` : ''}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    bufferRef.current = [];

    ws.onopen = () => {
      setIsConnected(true);
      setStatus('connected');

      for (const line of bufferRef.current) {
        term.write(line);
      }
      bufferRef.current = [];
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as TerminalMessage;

        if (msg.type === 'stdout' || msg.type === 'stderr') {
          const decoded = atob(msg.data);
          if (ws.readyState === WebSocket.OPEN) {
            term.write(decoded);
          } else {
            bufferRef.current.push(decoded);
          }
        } else if (msg.type === 'exit') {
          const exitMsg = `\r\n\x1b[33mSession terminée (code ${msg.code})\x1b[0m\r\n`;
          term.write(exitMsg);
          setIsConnected(false);
          if (msg.code === -1) {
            setStatus('disconnected');
          } else {
            setStatus('disconnected');
          }
        } else if (msg.type === 'info') {
          setShellEffectif(shell);
          if (msg.message.includes('fallback')) {
            setStatus('fallback');
            term.write(`\r\n\x1b[33m${msg.message}\x1b[0m\r\n`);
            setTimeout(() => setStatus('connected'), 500);
          } else {
            term.write(`\r\n\x1b[36m${msg.message}\x1b[0m\r\n`);
          }
        } else if (msg.type === 'error') {
          term.write(`\r\n\x1b[31m${msg.message}\x1b[0m\r\n`);
          setStatus('error');
        }
      } catch {
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      if (status !== 'disconnected' && status !== 'error') {
        const term = xtermRef.current;
        if (term) {
          term.write('\r\n\x1b[31mConnection perdue\x1b[0m\r\n');
        }
        setIsConnected(false);
        setStatus('disconnected');
      }
    };

    ws.onerror = () => {
      const term = xtermRef.current;
      if (term) {
        term.write('\r\n\x1b[31mErreur de connexion\x1b[0m\r\n');
      }
      setStatus('error');
      setIsConnected(false);
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stdin', data: btoa(data) }));
      }
    });
  }, [disconnect]);

  const fit = useCallback(() => {
    if (fitRef.current) {
      try { fitRef.current.fit(); } catch { /* ignore */ }
    }
  }, []);

  const clear = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  }, []);

  return {
    terminalRef,
    isConnected,
    status,
    shellEffectif,
    connect,
    disconnect,
    fit,
    clear,
  };
}

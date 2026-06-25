import { type Server as HttpServer } from 'node:http';
import { PassThrough } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { coreApi, getK8sConfig } from './k8s-client.js';
import { Exec } from '@kubernetes/client-node';
import { logger } from './logger.js';
import type { KubeConfig } from '@kubernetes/client-node';

const EXEC_PATH_PREFIX = '/api/v1/ws/kubernetes/pods';
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const FALLBACK_THRESHOLD_MS = 500;

interface WsExecSession {
  ws: WebSocket;
  namespace: string;
  podName: string;
  shell: string;
  container: string | undefined;
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  inactivityTimer: ReturnType<typeof setTimeout> | null;
  closed: boolean;
  kc: KubeConfig;
}

function parsePath(url: string): { namespace: string; podName: string; shell: string; container: string | undefined } | null {
  const path = url.split('?')[0] ?? url;
  const query = url.split('?')[1] ?? '';
  const params = new URLSearchParams(query);

  const expected = `${EXEC_PATH_PREFIX}/:namespace/:name/exec`;
  const parts = expected.split('/');
  const actualParts = path.split('/');

  if (actualParts.length !== parts.length) return null;

  const namespaceIdx = parts.indexOf(':namespace');
  const nameIdx = parts.indexOf(':name');

  if (namespaceIdx === -1 || nameIdx === -1) return null;

  const namespace = actualParts[namespaceIdx];
  const podName = actualParts[nameIdx];

  if (!namespace || !podName) return null;

  return {
    namespace,
    podName,
    shell: params.get('shell') ?? '/bin/sh',
    container: params.get('container') ?? undefined,
  };
}

function resetInactivityTimer(session: WsExecSession): void {
  if (session.inactivityTimer) clearTimeout(session.inactivityTimer);
  session.inactivityTimer = setTimeout(() => {
    logger.info({ namespace: session.namespace, pod: session.podName }, 'WS exec session timed out');
    sendJson(session.ws, { type: 'exit', code: -1 });
    cleanup(session);
  }, INACTIVITY_TIMEOUT_MS);
}

function cleanup(session: WsExecSession): void {
  if (session.closed) return;
  session.closed = true;
  if (session.inactivityTimer) clearTimeout(session.inactivityTimer);
  try { session.ws.close(); } catch { /* ignore */ }
  try { session.stdin.destroy(); } catch { /* ignore */ }
  try { session.stdout.destroy(); } catch { /* ignore */ }
  try { session.stderr.destroy(); } catch { /* ignore */ }
}

function sendJson(ws: WebSocket, msg: Record<string, unknown>): void {
  if (ws.readyState !== ws.OPEN) return;
  try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
}

function sendData(ws: WebSocket, type: string, data: Buffer): void {
  const encoded = data.toString('base64');
  sendJson(ws, { type, data: encoded });
}

async function attemptExec(
  kc: KubeConfig,
  session: WsExecSession,
  shell: string,
): Promise<boolean> {
  const { namespace, podName, container, stdin, stdout, stderr, ws } = session;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const startTime = Date.now();

    const exec = new Exec(kc);

    const statusCb = (s: { status?: string; code?: number; message?: string }): void => {
      if (settled) return;
      const elapsed = Date.now() - startTime;

      if (elapsed < FALLBACK_THRESHOLD_MS && s.status === 'Failure') {
        settled = true;
        logger.warn({ namespace, pod: podName, shell, code: s.code }, 'Shell exec failed immediately, fallback needed');
        resolve(false);
        return;
      }

      if (s.status === 'Success' || s.code === 0) {
        settled = true;
        return;
      }

      if (s.status === 'Failure') {
        settled = true;
        sendJson(ws, { type: 'exit', code: s.code ?? 1 });
        cleanup(session);
        resolve(true);
      }
    };

    try {
      exec.exec(
        namespace,
        podName,
        container ?? '',
        [shell],
        stdout,
        stderr,
        stdin,
        true,
        statusCb,
      );

      setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(true);
        }
      }, FALLBACK_THRESHOLD_MS + 100);
    } catch (err) {
      if (!settled) {
        settled = true;
        logger.error({ err, namespace, pod: podName, shell }, 'Failed to exec into pod');
        resolve(false);
      }
    }
  });
}

export function createWsExecServer(server: HttpServer): { close: () => void } {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '';

    if (!url.startsWith(EXEC_PATH_PREFIX)) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', async (ws: WebSocket, req) => {
    const parsed = parsePath(req.url ?? '');
    if (!parsed) {
      sendJson(ws, { type: 'error', message: 'Invalid path. Expected /api/v1/ws/kubernetes/pods/:namespace/:name/exec' });
      ws.close();
      return;
    }

    const { namespace, podName, shell, container } = parsed;

    try {
      await coreApi.readNamespacedPod({ namespace, name: podName });
    } catch {
      sendJson(ws, { type: 'error', message: 'Pod not found' });
      ws.close();
      return;
    }

    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const kc = getK8sConfig();

    const session: WsExecSession = {
      ws,
      namespace,
      podName,
      shell,
      container,
      stdin,
      stdout,
      stderr,
      inactivityTimer: null,
      closed: false,
      kc,
    };

    resetInactivityTimer(session);

    stdout.on('data', (chunk: Buffer) => {
      sendData(ws, 'stdout', chunk);
      resetInactivityTimer(session);
    });

    stderr.on('data', (chunk: Buffer) => {
      sendData(ws, 'stderr', chunk);
      resetInactivityTimer(session);
    });

    ws.on('message', (raw) => {
      resetInactivityTimer(session);
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; data?: string; cols?: number; rows?: number };
        if (msg.type === 'stdin' && msg.data) {
          const buf = Buffer.from(msg.data, 'base64');
          stdin.write(buf);
        }
      } catch {
        logger.warn({ namespace, pod: podName }, 'Invalid WS message');
      }
    });

    ws.on('close', () => cleanup(session));
    ws.on('error', () => cleanup(session));

    let currentShell = shell;
    const ok = await attemptExec(kc, session, currentShell);

    if (!ok) {
      if (currentShell !== '/bin/sh') {
        sendJson(ws, { type: 'info', message: 'Bash indisponible, bascule sur sh' });
        currentShell = '/bin/sh';
        const fallbackOk = await attemptExec(kc, session, currentShell);
        if (!fallbackOk) {
          sendJson(ws, { type: 'error', message: 'Aucun shell disponible' });
          cleanup(session);
          return;
        }
      } else {
        sendJson(ws, { type: 'error', message: 'Aucun shell disponible' });
        cleanup(session);
        return;
      }
    }

    logger.info({ namespace, pod: podName, shell: currentShell, container: container ?? '(default)' }, 'WS exec session started');
  });

  logger.info('WebSocket exec server attached');

  return {
    close: () => {
      wss.close();
    },
  };
}

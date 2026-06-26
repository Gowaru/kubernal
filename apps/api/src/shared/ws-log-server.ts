import { type Server as HttpServer } from 'node:http';
import { PassThrough } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { coreApi, k8sLog } from './k8s-client.js';
import { logger } from './logger.js';

const LOG_PATH_PREFIX = '/api/v1/ws/kubernetes/pods';
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

interface WsLogSession {
  ws: WebSocket;
  namespace: string;
  podName: string;
  container: string | undefined;
  tailLines: number | undefined;
  timestamps: boolean;
  logStream: PassThrough;
  abortController: AbortController | null;
  inactivityTimer: ReturnType<typeof setTimeout> | null;
  closed: boolean;
}

function parsePath(url: string): { namespace: string; podName: string; container: string | undefined; tailLines: number | undefined; timestamps: boolean } | null {
  const path = url.split('?')[0] ?? url;
  const query = url.split('?')[1] ?? '';
  const params = new URLSearchParams(query);

  const expected = `${LOG_PATH_PREFIX}/:namespace/:name/logs`;
  const parts = expected.split('/');
  const actualParts = path.split('/');

  if (actualParts.length !== parts.length) return null;

  const namespaceIdx = parts.indexOf(':namespace');
  const nameIdx = parts.indexOf(':name');

  if (namespaceIdx === -1 || nameIdx === -1) return null;

  const namespace = actualParts[namespaceIdx];
  const podName = actualParts[nameIdx];

  if (!namespace || !podName) return null;

  const tailLinesParam = params.get('tailLines');
  const timestampsParam = params.get('timestamps');

  return {
    namespace,
    podName,
    container: params.get('container') ?? undefined,
    tailLines: tailLinesParam ? parseInt(tailLinesParam, 10) : undefined,
    timestamps: timestampsParam === 'true',
  };
}

function resetInactivityTimer(session: WsLogSession): void {
  if (session.inactivityTimer) clearTimeout(session.inactivityTimer);
  session.inactivityTimer = setTimeout(() => {
    logger.info({ namespace: session.namespace, pod: session.podName }, 'WS log session timed out');
    cleanup(session);
  }, INACTIVITY_TIMEOUT_MS);
}

function cleanup(session: WsLogSession): void {
  if (session.closed) return;
  session.closed = true;
  if (session.inactivityTimer) clearTimeout(session.inactivityTimer);
  if (session.abortController) session.abortController.abort();
  try { session.ws.close(); } catch { /* ignore */ }
  try { session.logStream.destroy(); } catch { /* ignore */ }
}

function sendJson(ws: WebSocket, msg: Record<string, unknown>): void {
  if (ws.readyState !== ws.OPEN) return;
  try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
}

export function createWsLogServer(server: HttpServer): { close: () => void } {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '';

    if (!url.startsWith(`${LOG_PATH_PREFIX}/`) || !url.endsWith('/logs')) {
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', async (ws: WebSocket, req) => {
    const parsed = parsePath(req.url ?? '');
    if (!parsed) {
      sendJson(ws, { type: 'error', message: 'Invalid path. Expected /api/v1/ws/kubernetes/pods/:namespace/:name/logs' });
      ws.close();
      return;
    }

    const { namespace, podName, container, tailLines, timestamps } = parsed;

    try {
      await coreApi.readNamespacedPod({ namespace, name: podName });
    } catch {
      sendJson(ws, { type: 'error', message: 'Pod not found' });
      ws.close();
      return;
    }

    const logStream = new PassThrough();

    const session: WsLogSession = {
      ws,
      namespace,
      podName,
      container,
      tailLines,
      timestamps,
      logStream,
      abortController: null,
      inactivityTimer: null,
      closed: false,
    };

    resetInactivityTimer(session);

    logStream.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.length > 0) {
          sendJson(ws, { type: 'log', line });
        }
      }
      resetInactivityTimer(session);
    });

    logStream.on('end', () => {
      sendJson(ws, { type: 'eof' });
      cleanup(session);
    });

    logStream.on('error', (err: Error) => {
      sendJson(ws, { type: 'error', message: err.message });
      cleanup(session);
    });

    ws.on('close', () => cleanup(session));
    ws.on('error', () => cleanup(session));

    try {
      const abortController = await k8sLog.log(namespace, podName, container ?? '', logStream, {
        follow: true,
        tailLines,
        timestamps,
      });
      session.abortController = abortController;
      logger.info({ namespace, pod: podName, container: container ?? '(default)', tailLines, timestamps }, 'WS log session started');
    } catch (err) {
      logger.error({ err, namespace, pod: podName }, 'Failed to stream pod logs');
      sendJson(ws, { type: 'error', message: 'Failed to stream pod logs' });
      cleanup(session);
    }
  });

  logger.info('WebSocket log server attached');

  return {
    close: () => {
      wss.close();
    },
  };
}

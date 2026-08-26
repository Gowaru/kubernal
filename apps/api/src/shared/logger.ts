// =============================================================================
// Structured JSON Logger
// =============================================================================

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      }
    : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.headers.authorization',
      '*.headers.cookie',
      'password',
      'secret',
      'token',
    ],
    remove: true,
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      requestId: (req as unknown as { requestId?: string }).requestId,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
});

export function childLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}

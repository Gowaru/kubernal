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
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: req.headers,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
});

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { auditService } from '../../modules/audit/audit.service.js';

type AuditedRequest = Request & {
  requestId: string;
  actor: { id: string; email: string } | null;
  realIp: string;
};

const SENSITIVE_BODY_KEYS = new Set(['secret', 'password', 'token', 'apiKey', 'webhookSecret']);

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(sanitizeBody);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_BODY_KEYS.has(key)) {
      sanitized[key] = '***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBody(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function auditContext(req: Request, _res: Response, next: NextFunction): void {
  const augmented = req as AuditedRequest;
  augmented.requestId = randomUUID();
  augmented.actor = req.user ? { id: req.user.id, email: req.user.email } : null;
  augmented.realIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
  _res.setHeader('X-Request-Id', augmented.requestId);

  const originalJson = _res.json.bind(_res);
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  _res.json = function (body: unknown) {
    const method = req.method;
    if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
      let action: string | undefined;
      if (method === 'POST') action = 'CREATE';
      else if (method === 'PUT' || method === 'PATCH') action = 'UPDATE';
      else if (method === 'DELETE') action = 'DELETE';

      if (action) {
        const resourceSegments = req.path.split('/').filter(Boolean);
        const resourceName = resourceSegments[0] ?? 'unknown';
        const rid = resourceSegments[1] ?? undefined;

        auditService
          .log({
            action: action as 'CREATE' | 'UPDATE' | 'DELETE',
            resource: resourceName,
            resourceId: rid,
            details: {
              params: req.params,
              body: sanitizeBody(req.body),
              statusCode: _res.statusCode,
            },
            actorId: augmented.actor?.id,
            actorEmail: augmented.actor?.email,
            ip: augmented.realIp,
            userAgent: (req.headers['user-agent'] as string) ?? null,
          })
          .catch(() => {});
      }
    }
    return originalJson.call(_res, body);
  };

  next();
}

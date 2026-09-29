import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { auditService } from '../../modules/audit/audit.service.js';
import { redactSensitiveKeys } from '../serializers.js';

type AuditedRequest = Request & {
  requestId: string;
  actor: { id: string; email: string } | null;
  realIp: string;
};

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
              body: redactSensitiveKeys(req.body),
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

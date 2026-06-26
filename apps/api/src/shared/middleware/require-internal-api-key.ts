import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ForbiddenError } from '../errors.js';
import { logger } from '../logger.js';

const HEADER_NAME = 'x-internal-api-key';

function getExpectedKey(): string | null {
  const key = process.env['INTERNAL_API_KEY'];
  if (!key || key.length < 16) {
    return null;
  }
  return key;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function requireInternalApiKey() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const expected = getExpectedKey();
    if (!expected) {
      logger.error(
        '[require-internal-api-key] INTERNAL_API_KEY is missing or too short (min 16 chars). ' +
          'Refusing to process protected endpoint.',
      );
      throw new ForbiddenError('Endpoint not configured');
    }

    const provided = req.headers[HEADER_NAME];
    const providedValue = Array.isArray(provided) ? provided[0] : provided;
    if (!providedValue || !safeEqual(providedValue, expected)) {
      logger.warn(
        { method: req.method, path: req.path, hasHeader: !!providedValue },
        '[require-internal-api-key] Rejected request (invalid or missing key)',
      );
      throw new ForbiddenError('Invalid or missing x-internal-api-key header');
    }

    next();
  };
}

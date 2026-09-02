import type { Request, Response, NextFunction } from 'express';

export function sessionRefresh(req: Request, _res: Response, next: NextFunction): void {
  const userId = (req.session as unknown as Record<string, unknown> | undefined)?.userId;
  if (userId) {
    req.session.touch();
  }
  next();
}

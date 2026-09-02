import type { Request, Response, NextFunction } from 'express';
import type { User } from '@kubernal/shared-types';
import { db } from '../database.js';

export async function deserializeUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (req.user) {
      return next();
    }

    const userId = (req.session as unknown as Record<string, unknown> | undefined)?.userId as
      | string
      | undefined;
    if (!userId) {
      return next();
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      req.session.destroy(() => {});
      return next();
    }

    const { passwordHash, ...safeUser } = user;
    void passwordHash;
    req.user = safeUser as User;
    next();
  } catch (err) {
    next(err);
  }
}

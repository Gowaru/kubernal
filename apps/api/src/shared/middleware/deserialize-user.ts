import type { Request, Response, NextFunction } from 'express';
import { db } from '../database.js';
import { toPublicUser } from '../serializers.js';

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

    req.user = toPublicUser(user);
    next();
  } catch (err) {
    next(err);
  }
}

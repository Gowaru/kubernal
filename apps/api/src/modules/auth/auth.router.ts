import { Router, type Request, type Response, type NextFunction } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import { loginUserSchema } from './auth.schema.js';
import { validateCredentials } from './auth.service.js';
import { requireAuth } from '../../shared/middleware/auth.js';
import { createOidcRouter } from './oidc.router.js';

export function createAuthRouter(): Router {
  const router = Router();

  router.use('/oidc', createOidcRouter());

  router.post(
    '/login',
    validate(loginUserSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, password, rememberMe } = req.body;
        const user = await validateCredentials(email, password);
        (req.session as unknown as Record<string, unknown>).userId = user.id;
        req.user = user as typeof req.user;
        if (rememberMe) {
          const rememberMaxAge = req.app.locals.sessionDefaults?.rememberMaxAge;
          if (rememberMaxAge) {
            req.session.cookie.maxAge = rememberMaxAge;
          }
        }
        return res.json({ success: true, data: user });
      } catch (err) {
        return next(err);
      }
    },
  );

  router.post('/logout', requireAuth(), (req: Request, res: Response, next: NextFunction) => {
    req.session.destroy((err) => {
      if (err) {
        next(err);
        return;
      }
      res.json({ success: true });
    });
  });

  router.get('/me', requireAuth(), (req: Request, res: Response) => {
    res.json({ success: true, data: req.user });
  });

  return router;
}

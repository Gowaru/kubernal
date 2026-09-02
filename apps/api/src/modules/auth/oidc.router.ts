import { Router, type Request, type Response } from 'express';
import { getGitHubAuthUrl, handleGitHubCallback } from './oidc.service.js';
import { findOrCreateOidcUser } from './auth.service.js';

export function createOidcRouter(): Router {
  const router = Router();

  router.get('/github', (req: Request, res: Response) => {
    try {
      const url = getGitHubAuthUrl(req);
      res.redirect(url);
    } catch (err) {
      const message = encodeURIComponent(
        err instanceof Error ? err.message : 'SSO configuration error',
      );
      const portalUrl = process.env['PORTAL_URL'] || 'http://localhost:3000';
      res.redirect(`${portalUrl}/login?error=${message}`);
    }
  });

  router.get('/github/callback', async (req: Request, res: Response) => {
    const portalUrl = process.env['PORTAL_URL'] || 'http://localhost:3000';
    try {
      const code = req.query['code'] as string | undefined;
      const returnedState = req.query['state'] as string | undefined;

      if (!code) {
        res.redirect(
          `${portalUrl}/login?error=${encodeURIComponent('Missing authorization code')}`,
        );
        return;
      }

      const sessionState = (req.session as unknown as Record<string, unknown>).oidcState as
        | string
        | undefined;
      if (!sessionState || sessionState !== returnedState) {
        res.redirect(`${portalUrl}/login?error=${encodeURIComponent('Invalid state parameter')}`);
        return;
      }

      delete (req.session as unknown as Record<string, unknown>).oidcState;

      const profile = await handleGitHubCallback(code);
      const user = await findOrCreateOidcUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        oidcProvider: 'github',
      });

      (req.session as unknown as Record<string, unknown>).userId = user.id;

      res.redirect(`${portalUrl}/auth/callback`);
    } catch (err) {
      const message = encodeURIComponent(err instanceof Error ? err.message : 'SSO login failed');
      res.redirect(`${portalUrl}/login?error=${message}`);
    }
  });

  return router;
}

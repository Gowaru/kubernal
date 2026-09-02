import type { Request, Response } from 'express';
import { db } from '../../shared/database.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { auditService } from '../audit/audit.service.js';
import { triggerReconcile } from '../deployment/deployment.worker.js';
import {
  detectProviderFromPath,
  generateSecret,
  parsePushEvent,
  verifySignature,
  type WebhookProvider,
} from '../../shared/webhook-verify.js';

interface AppWebhookInfo {
  applicationId: string;
  provider: WebhookProvider;
  hasSecret: boolean;
  url: string;
}

function buildWebhookUrl(req: Request, appId: string, provider: WebhookProvider): string {
  const proto = req.headers['x-forwarded-proto'] ?? req.protocol ?? 'http';
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost:4000';
  return `${proto}://${host}/api/v1/webhooks/${appId}/${provider}`;
}

export const webhookController = {
  async getConfig(req: Request, res: Response): Promise<void> {
    const { appId } = req.params as { appId: string };
    const app = await db.application.findUnique({
      where: { id: appId },
      select: { id: true, repositoryUrl: true, webhookSecret: true },
    });
    if (!app) throw new NotFoundError('Application', appId);

    const provider = detectProviderFromPath(
      app.repositoryUrl?.includes('gitlab.com')
        ? 'gitlab'
        : app.repositoryUrl?.includes('bitbucket.org')
          ? 'bitbucket'
          : 'github',
    );

    const data: AppWebhookInfo = {
      applicationId: app.id,
      provider: provider ?? 'github',
      hasSecret: !!app.webhookSecret,
      url: provider ? buildWebhookUrl(req, app.id, provider) : '',
    };

    res.json({ data });
  },

  async regenerateSecret(req: Request, res: Response): Promise<void> {
    const { appId } = req.params as { appId: string };
    const app = await db.application.findUnique({ where: { id: appId } });
    if (!app) throw new NotFoundError('Application', appId);

    const newSecret = generateSecret();
    await db.application.update({
      where: { id: appId },
      data: { webhookSecret: newSecret },
    });

    auditService
      .log({
        action: 'REGENERATE',
        resource: 'Application',
        resourceId: appId,
        details: { field: 'webhookSecret' } as Record<string, unknown>,
      })
      .catch(() => {});

    res.json({ data: { applicationId: appId, secret: newSecret } });
  },

  async ingest(req: Request, res: Response): Promise<void> {
    const { appId, provider } = req.params as { appId: string; provider: string };
    const webhookProvider = detectProviderFromPath(provider);
    if (!webhookProvider) {
      throw new ValidationError(`Provider invalide: ${provider}`);
    }

    const app = await db.application.findUnique({ where: { id: appId } });
    if (!app) throw new NotFoundError('Application', appId);

    if (!app.webhookSecret) {
      throw new ValidationError(
        "Webhook non configuré pour cette application. Générer un secret depuis l'UI.",
      );
    }

    const rawBody = (req as Request & { rawBody?: string }).rawBody ?? '';
    if (!rawBody) {
      throw new ValidationError('Body brut manquant (vérifier le middleware express.raw)');
    }

    const headers = req.headers as Record<string, string | string[] | undefined>;
    if (!verifySignature(webhookProvider, rawBody, headers, app.webhookSecret)) {
      logger.warn({ appId, provider: webhookProvider }, 'Webhook signature mismatch');
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Signature du webhook invalide' },
      });
      return;
    }

    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new ValidationError('Body JSON invalide');
    }

    const eventType =
      (headers['x-github-event'] as string | undefined) ??
      (headers['x-gitlab-event'] as string | undefined) ??
      (headers['x-event-key'] as string | undefined) ??
      'push';
    if (eventType !== 'push') {
      res.json({ data: { ignored: true, reason: `Event type '${eventType}' non géré` } });
      return;
    }

    const pushInfo = parsePushEvent(webhookProvider, parsedBody);
    if (!pushInfo) {
      throw new ValidationError("Impossible d'extraire le commit du payload");
    }

    const env = await db.environment.findFirst({
      where: { applicationId: appId, type: 'dev' },
    });
    if (!env) {
      throw new NotFoundError('Environment (dev)', appId);
    }

    const shortSha = pushInfo.commitSha.slice(0, 7);
    const version = `git-${shortSha}`;

    const deployment = await db.deployment.create({
      data: {
        applicationId: appId,
        environmentId: env.id,
        version,
        commitSha: pushInfo.commitSha,
        trigger: 'git_push',
        status: env.requiresApproval ? 'pending' : 'building',
      },
    });

    if (deployment.status === 'building') {
      void triggerReconcile(deployment.id);
    }

    logger.info(
      {
        appId,
        provider: webhookProvider,
        commit: shortSha,
        branch: pushInfo.branch,
        deploymentId: deployment.id,
      },
      'Webhook ingest: deployment créé',
    );

    res.status(201).json({
      data: {
        kind: 'DeploymentCreated',
        deploymentId: deployment.id,
        version,
        commitSha: pushInfo.commitSha,
        branch: pushInfo.branch,
        author: pushInfo.sender,
        status: deployment.status,
      },
    });
  },
};

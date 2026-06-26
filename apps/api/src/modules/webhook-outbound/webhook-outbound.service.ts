import { db } from '../../shared/database.js';
import type { Prisma } from '@prisma/client';
import { auditService } from '../audit/audit.service.js';

type DeployEvent = 'started' | 'success' | 'failure' | 'rolled_back' | 'cancelled' | 'approval_needed';

interface DeployPayload {
  applicationId: string;
  applicationName: string;
  version: string;
  environmentName: string;
  environmentType: string;
  commitSha: string;
  deploymentId: string;
  deploymentUrl?: string;
  triggeredBy?: string;
  errorMessage?: string;
  approvalUrl?: string;
}

function buildSlackBlocks(event: DeployEvent, data: DeployPayload): Record<string, unknown>[] {
  const statusText = {
    started: '🚀 Déploiement démarré',
    success: '✅ Déploiement réussi',
    failure: '❌ Déploiement échoué',
    rolled_back: '⏪ Déploiement rollbacké',
    cancelled: '🚫 Déploiement annulé',
    approval_needed: '👀 Approbation requise',
  }[event];

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: statusText, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Application:*\n${data.applicationName}` },
        { type: 'mrkdwn', text: `*Version:*\n${data.version}` },
        { type: 'mrkdwn', text: `*Environnement:*\n${data.environmentName} (${data.environmentType})` },
        { type: 'mrkdwn', text: `*Commit:*\n\`${data.commitSha.slice(0, 7)}\`` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Déploiement:* <${data.deploymentUrl ?? '#'}|${data.deploymentId.slice(0, 8)}>` },
    },
  ];

  if (data.errorMessage) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Erreur:*\n\`\`\`${data.errorMessage}\`\`\`` },
    });
  }

  if (event === 'approval_needed' && data.approvalUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approuver', emoji: true },
          style: 'primary',
          url: data.approvalUrl,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Rejeter', emoji: true },
          style: 'danger',
          url: `${data.approvalUrl}/reject`,
        },
      ],
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `Envoyé par Kubernal IDP · ${new Date().toISOString()}` },
    ],
  });

  return [{ type: 'section', text: { type: 'mrkdwn', text: `*${statusText}*` } }, ...blocks];
}

async function sendWebhook(url: string, body: Record<string, unknown>, secret?: string): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) {
    headers['X-Kubernal-Signature'] = secret;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const responseBody = await response.text();
    return { status: response.status, body: responseBody };
  } finally {
    clearTimeout(timeout);
  }
}

async function retrySend(
  url: string,
  body: Record<string, unknown>,
  secret: string | undefined,
  maxRetries = 3,
): Promise<{ status: number; body: string; retryCount: number }> {
  let lastError: Error | null = null;
  let lastStatus = 0;
  let lastBody = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(1000 * 2 ** attempt, 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    try {
      const result = await sendWebhook(url, body, secret);
      if (result.status >= 200 && result.status < 300) {
        return { ...result, retryCount: attempt };
      }
      lastStatus = result.status;
      lastBody = result.body;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (lastError) throw lastError;
  return { status: lastStatus, body: lastBody, retryCount: maxRetries };
}

export const webhookOutboundService = {
  async dispatch(event: DeployEvent, data: DeployPayload): Promise<void> {
    const configs = await db.webhookConfig.findMany({
      where: {
        applicationId: data.applicationId,
        enabled: true,
        events: { has: event },
      },
    });

    await Promise.all(
      configs.map(async (config) => {
        const payload = { event, blocks: buildSlackBlocks(event, data) };
        const delivery = await db.webhookDelivery.create({
          data: {
            webhookConfigId: config.id,
            event,
            requestBody: payload as Prisma.InputJsonValue,
          },
        });

        try {
          const start = Date.now();
          const result = await retrySend(config.url, payload as Record<string, unknown>, config.secret ?? undefined);
          await db.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: 'success',
              responseStatus: result.status,
              responseBody: result.body,
              durationMs: Date.now() - start,
              retryCount: result.retryCount,
            },
          });
        } catch (error) {
          await db.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : String(error),
              durationMs: null,
            },
          });
        }
      }),
    );
  },

  async listConfigs(applicationId: string) {
    return db.webhookConfig.findMany({ where: { applicationId }, orderBy: { createdAt: 'desc' } });
  },

  async getConfig(id: string) {
    const config = await db.webhookConfig.findUnique({ where: { id } });
    if (!config) throw new Error(`WebhookConfig ${id} not found`);
    return config;
  },

  async createConfig(data: {
    applicationId: string;
    name?: string;
    url: string;
    secret?: string;
    events?: string[];
  }) {
    const count = await db.webhookConfig.count({ where: { applicationId: data.applicationId } });
    if (count >= 10) {
      throw new Error('Maximum 10 webhook configs per application');
    }
    const result = await db.webhookConfig.create({
      data: {
        applicationId: data.applicationId,
        name: data.name ?? 'default',
        url: data.url,
        secret: data.secret,
        events: data.events ?? ['started', 'success', 'failure'],
      },
    });
    auditService.log({
      action: 'CREATE',
      resource: 'WebhookConfig',
      resourceId: result.id,
      details: { applicationId: data.applicationId, name: result.name } as Record<string, unknown>,
    }).catch(() => {});
    return result;
  },

  async updateConfig(id: string, data: { name?: string; url?: string; secret?: string; events?: string[]; enabled?: boolean }) {
    const result = await db.webhookConfig.update({ where: { id }, data });
    auditService.log({
      action: 'UPDATE',
      resource: 'WebhookConfig',
      resourceId: id,
      details: data as Record<string, unknown>,
    }).catch(() => {});
    return result;
  },

  async deleteConfig(id: string) {
    const result = await db.webhookConfig.delete({ where: { id } });
    auditService.log({
      action: 'DELETE',
      resource: 'WebhookConfig',
      resourceId: id,
    }).catch(() => {});
    return result;
  },

  async testConfig(id: string) {
    const config = await db.webhookConfig.findUnique({ where: { id } });
    if (!config) throw new Error(`WebhookConfig ${id} not found`);
    auditService.log({
      action: 'TEST',
      resource: 'WebhookConfig',
      resourceId: id,
    }).catch(() => {});
    await this.dispatch('started', {
      applicationId: config.applicationId,
      applicationName: 'Test Webhook',
      version: '0.0.0-test',
      environmentName: 'test',
      environmentType: 'dev',
      commitSha: '0000000000000000000000000000000000000000',
      deploymentId: 'test-' + id.slice(0, 8),
      deploymentUrl: '#',
    });
  },

  async listDeliveries(webhookConfigId: string, limit = 20) {
    return db.webhookDelivery.findMany({
      where: { webhookConfigId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};

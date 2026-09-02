import crypto from 'node:crypto';
import { db } from '../../shared/database.js';
import type { ApiKeyCreated } from '@kubernal/shared-types';
import { NotFoundError, ForbiddenError } from '../../shared/errors.js';

const KEY_LENGTH = 32;
const PREFIX = 'kpl_';

function generateKey(): { plainKey: string; keyHash: string; prefix: string } {
  const random = crypto.randomBytes(KEY_LENGTH).toString('base64url');
  const plainKey = `${PREFIX}${random}`;
  const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
  return { plainKey, keyHash, prefix: PREFIX };
}

function toApiKeyCreated(row: { id: string; name: string; prefix: string; expiresAt: Date | null; lastUsedAt: Date | null; createdAt: Date }, plainKey: string): ApiKeyCreated {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    plainKey,
  };
}

export const apiKeyService = {
  async createKey(userId: string, name: string, expiresInDays?: number): Promise<ApiKeyCreated> {
    const { plainKey, keyHash, prefix } = generateKey();

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const key = await db.apiKey.create({
      data: { userId, name, keyHash, prefix, expiresAt },
    });

    return toApiKeyCreated(key, plainKey);
  },

  async listKeys(userId: string): Promise<Array<{ id: string; name: string; prefix: string; expiresAt: string | null; lastUsedAt: string | null; createdAt: string }>> {
    const keys = await db.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    }));
  },

  async deleteKey(userId: string, keyId: string): Promise<void> {
    const key = await db.apiKey.findUnique({ where: { id: keyId } });
    if (!key) throw new NotFoundError('ApiKey', keyId);
    if (key.userId !== userId) throw new ForbiddenError('Cannot delete another user\'s API key');

    await db.apiKey.delete({ where: { id: keyId } });
  },
};

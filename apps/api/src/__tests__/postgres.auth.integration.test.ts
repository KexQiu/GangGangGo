import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { DatabaseClient } from '../db/client.js';
import { authSessions } from '../db/schema.js';
import { createDrizzleAuthSessionService, SessionUserUnavailableError } from '../modules/auth/authSessionService.js';
import {
  cleanupIntegrationUsers,
  createIntegrationDatabaseClient,
  createIntegrationUser,
  describeWithDatabase,
} from './postgresTestUtils.js';

describeWithDatabase('postgres auth integration', () => {
  let client: DatabaseClient;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    client = createIntegrationDatabaseClient();
  });

  afterAll(async () => {
    await cleanupIntegrationUsers(client, createdUserIds);
  });

  it('covers session creation, rotation, old-token invalidation, logout, and expiration', async () => {
    const user = await createIntegrationUser(client, createdUserIds, 'session-user');
    const service = createDrizzleAuthSessionService(client.db);
    const first = await service.create(user.id);
    const firstSessionId = extractSessionId(first.accessToken);

    expect(await service.isActive(firstSessionId, user.id)).toBe(true);

    const rotated = await service.rotate(first.refreshToken);
    const rotatedSessionId = extractSessionId(rotated.session.accessToken);

    expect(rotated.userId).toBe(user.id);
    expect(await service.isActive(firstSessionId, user.id)).toBe(false);
    expect(await service.isActive(rotatedSessionId, user.id)).toBe(true);
    await expect(service.rotate(first.refreshToken)).rejects.toMatchObject({ code: 'unauthorized', statusCode: 401 });

    await service.revoke(rotatedSessionId);
    expect(await service.isActive(rotatedSessionId, user.id)).toBe(false);
    await expect(service.rotate(rotated.session.refreshToken)).rejects.toMatchObject({
      code: 'unauthorized',
      statusCode: 401,
    });

    const expiring = await service.create(user.id);
    const expiringSessionId = extractSessionId(expiring.accessToken);
    await client.db
      .update(authSessions)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(authSessions.id, expiringSessionId));

    expect(await service.isActive(expiringSessionId, user.id)).toBe(false);
    await expect(service.rotate(expiring.refreshToken)).rejects.toMatchObject({
      code: 'unauthorized',
      statusCode: 401,
    });
  });

  it('reports a missing session user as retryable instead of leaking a foreign-key failure', async () => {
    const service = createDrizzleAuthSessionService(client.db);

    await expect(service.create(randomUUID())).rejects.toBeInstanceOf(SessionUserUnavailableError);
  });
});

describe('extractSessionId', () => {
  it('reads the session id from an access token payload', () => {
    const token = `header.${Buffer.from(JSON.stringify({ sessionId: 'session-id' })).toString('base64url')}.signature`;
    expect(extractSessionId(token)).toBe('session-id');
  });
});

function extractSessionId(token: string) {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Invalid JWT.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).sessionId as string;
}

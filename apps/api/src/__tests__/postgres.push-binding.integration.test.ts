import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '../db/client.js';
import { authSessions, pushTokens } from '../db/schema.js';
import { createDrizzleAuthSessionService } from '../modules/auth/authSessionService.js';
import { verifyAccessToken } from '../modules/auth/token.js';
import { createDrizzlePushTokenService } from '../modules/push/pushTokenService.js';
import { createExpoPushNotificationService } from '../modules/push/pushNotificationService.js';
import {
  cleanupIntegrationUsers,
  createIntegrationDatabaseClient,
  createIntegrationUser,
  describeWithDatabase,
} from './postgresTestUtils.js';

describeWithDatabase('push bindings follow a device session family', () => {
  let client: DatabaseClient;
  const userIds: string[] = [];
  beforeAll(() => {
    client = createIntegrationDatabaseClient();
  });
  afterAll(async () => {
    await cleanupIntegrationUsers(client, userIds);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps rotation, revokes only the logged-out device, and never retargets a delayed revoke', async () => {
    const a = await createIntegrationUser(client, userIds, 'push-a');
    const b = await createIntegrationUser(client, userIds, 'push-b');
    const auth = createDrizzleAuthSessionService(client.db);
    const bindings = createDrizzlePushTokenService(client.db);
    const sender = createExpoPushNotificationService(client.db);
    const first = await auth.create(a.id);
    const other = await auth.create(a.id);
    const firstId = (await verifyAccessToken(first.accessToken)).sessionId;
    const otherId = (await verifyAccessToken(other.accessToken)).sessionId;
    const token = `ExpoPushToken[${randomUUID()}]`;
    const otherToken = `ExpoPushToken[${randomUUID()}]`;
    const input = { deviceId: 'phone', token, provider: 'expo' as const, platform: 'ios' as const };
    await bindings.registerToken(a, input, firstId);
    await bindings.registerToken(a, { ...input, deviceId: 'tablet', token: otherToken }, otherId);
    const sent: string[][] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const messages = JSON.parse(options.body as string) as { to: string }[];
        sent.push(messages.map((message) => message.to));
        return Response.json({ data: messages.map(() => ({ status: 'ok' })) });
      }),
    );
    const send = (userId: string) => sender.sendToUser({ userId, title: 'test', body: 'test' });

    const rotated = await auth.rotate(first.refreshToken);
    const rotatedId = (await verifyAccessToken(rotated.session.accessToken)).sessionId;
    await send(a.id);
    expect(sent.at(-1)?.sort()).toEqual([token, otherToken].sort());
    await auth.revokeRefreshToken(first.refreshToken); // Lost rotation response + offline logout.
    expect(await auth.isActive(rotatedId, a.id)).toBe(false);
    expect(await auth.isActive(otherId, a.id)).toBe(true);
    await send(a.id);
    expect(sent.at(-1)).toEqual([otherToken]);
    await expect(bindings.registerToken(a, input, rotatedId)).rejects.toMatchObject({ statusCode: 401 });

    const next = await auth.create(b.id);
    const nextId = (await verifyAccessToken(next.accessToken)).sessionId;
    await bindings.registerToken(b, input, nextId);
    await bindings.revokeDevice(a, 'phone', rotatedId);
    await auth.revokeRefreshToken(first.refreshToken);
    await send(b.id);
    expect(sent.at(-1)).toEqual([token]);
    await bindings.revokeDevice(b, 'phone', nextId);
    const count = sent.length;
    await send(b.id);
    expect(sent).toHaveLength(count);

    await client.db
      .update(authSessions)
      .set({ expiresAt: new Date(0) })
      .where(eq(authSessions.id, otherId));
    await send(a.id);
    expect(sent).toHaveLength(count);
  });

  it('does not disable a new binding when an old provider error returns late', async () => {
    const owner = await createIntegrationUser(client, userIds, 'push-late');
    const auth = createDrizzleAuthSessionService(client.db);
    const bindings = createDrizzlePushTokenService(client.db);
    const firstId = (await verifyAccessToken((await auth.create(owner.id)).accessToken)).sessionId;
    const nextId = (await verifyAccessToken((await auth.create(owner.id)).accessToken)).sessionId;
    const input = { deviceId: 'phone', token: randomUUID(), provider: 'expo' as const, platform: 'ios' as const };
    const binding = await bindings.registerToken(owner, input, firstId);
    let release!: () => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = () =>
              resolve(Response.json({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }));
          }),
      ),
    );
    const sending = createExpoPushNotificationService(client.db).sendToUser({
      userId: owner.id,
      title: 'test',
      body: 'test',
    });
    await vi.waitFor(() => expect(release).toBeDefined());
    await bindings.registerToken(owner, input, nextId);
    release();
    await sending;
    const [current] = await client.db.select().from(pushTokens).where(eq(pushTokens.id, binding.id));
    expect(current).toMatchObject({ enabled: true, sessionId: nextId });
  });

  it('serializes concurrent rotation and offline revocation of the same family', async () => {
    const owner = await createIntegrationUser(client, userIds, 'push-race');
    const auth = createDrizzleAuthSessionService(client.db);
    const first = await auth.create(owner.id);
    await Promise.allSettled([auth.rotate(first.refreshToken), auth.revokeRefreshToken(first.refreshToken)]);
    const sessions = await client.db.select().from(authSessions).where(eq(authSessions.userId, owner.id));
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
  });
});

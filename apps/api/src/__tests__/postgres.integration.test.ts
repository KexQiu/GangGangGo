import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { DatabaseClient } from '../db/client.js';
import { authSessions, teamInvites } from '../db/schema.js';
import { createDrizzleAuthSessionService, SessionUserUnavailableError } from '../modules/auth/authSessionService.js';
import { createDrizzleTeamService } from '../modules/teams/teamService.js';
import {
  cleanupIntegrationUsers,
  createIntegrationDatabaseClient,
  createIntegrationUser,
  describeWithDatabase,
} from './postgresTestUtils.js';

describeWithDatabase('postgres auth and team integration', () => {
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

  it('serializes concurrent team creation for one user', async () => {
    const service = createDrizzleTeamService(client.db);
    const owner = await createIntegrationUser(client, createdUserIds, 'concurrent-owner');
    const results = await Promise.allSettled([
      service.createTeam(owner, { name: '并发队 A' }),
      service.createTeam(owner, { name: '并发队 B' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'conflict', statusCode: 409 },
    });
    expect((await service.getCurrentTeam(owner)).team?.members).toHaveLength(1);
  });

  it('allows only one current membership when two teams accept the same user concurrently', async () => {
    const service = createDrizzleTeamService(client.db);
    const firstOwner = await createIntegrationUser(client, createdUserIds, 'first-owner');
    const secondOwner = await createIntegrationUser(client, createdUserIds, 'second-owner');
    const candidate = await createIntegrationUser(client, createdUserIds, 'shared-candidate');
    await service.createTeam(firstOwner, { name: '第一队' });
    await service.createTeam(secondOwner, { name: '第二队' });
    const [firstInvite, secondInvite] = await Promise.all([
      service.createInvite(firstOwner),
      service.createInvite(secondOwner),
    ]);
    const results = await Promise.allSettled([
      service.acceptInvite(candidate, firstInvite.token, {}),
      service.acceptInvite(candidate, secondInvite.token, {}),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await service.getCurrentTeam(candidate)).team).not.toBeNull();
  });

  it('keeps concurrent invite acceptance within the four-member team limit', async () => {
    const service = createDrizzleTeamService(client.db);
    const owner = await createIntegrationUser(client, createdUserIds, 'capacity-owner');
    const buddies = await Promise.all(
      Array.from({ length: 4 }, (_, index) => createIntegrationUser(client, createdUserIds, `capacity-buddy-${index}`)),
    );
    await service.createTeam(owner, { name: '并发容量队' });
    const invites = await Promise.all(buddies.map(() => service.createInvite(owner)));
    const results = await Promise.allSettled(
      buddies.map((buddy, index) => service.acceptInvite(buddy, invites[index]!.token, {})),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await service.getCurrentTeam(owner)).team?.members).toHaveLength(4);
  });

  it('rejects repeated, expired, and capacity-invalid invite acceptance', async () => {
    const service = createDrizzleTeamService(client.db);

    const repeatOwner = await createIntegrationUser(client, createdUserIds, 'repeat-owner');
    const repeatBuddy = await createIntegrationUser(client, createdUserIds, 'repeat-buddy');
    await service.createTeam(repeatOwner, { name: '重复邀请队' });
    const repeatInvite = await service.createInvite(repeatOwner);
    await service.acceptInvite(repeatBuddy, repeatInvite.token, {});
    await expect(service.acceptInvite(repeatBuddy, repeatInvite.token, {})).rejects.toMatchObject({
      code: 'conflict',
      statusCode: 409,
    });

    const expiredOwner = await createIntegrationUser(client, createdUserIds, 'expired-owner');
    const expiredBuddy = await createIntegrationUser(client, createdUserIds, 'expired-buddy');
    await service.createTeam(expiredOwner, { name: '过期邀请队' });
    const expiredInvite = await service.createInvite(expiredOwner);
    await client.db
      .update(teamInvites)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(teamInvites.id, expiredInvite.inviteId));
    await expect(service.acceptInvite(expiredBuddy, expiredInvite.token, {})).rejects.toMatchObject({
      code: 'not_found',
      statusCode: 404,
    });

    const fullOwner = await createIntegrationUser(client, createdUserIds, 'full-owner');
    const fullTarget = await createIntegrationUser(client, createdUserIds, 'full-target');
    const fillers = await Promise.all(
      Array.from({ length: 3 }, (_, index) => createIntegrationUser(client, createdUserIds, `filler-${index}`)),
    );
    await service.createTeam(fullOwner, { name: '满员队' });
    const targetInvite = await service.createInvite(fullOwner);
    for (const filler of fillers) {
      const invite = await service.createInvite(fullOwner);
      await service.acceptInvite(filler, invite.token, {});
    }
    await expect(service.acceptInvite(fullTarget, targetInvite.token, {})).rejects.toMatchObject({
      code: 'conflict',
      statusCode: 409,
    });
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

import { randomUUID } from 'node:crypto';

import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { DatabaseClient } from '../db/client.js';
import { createDatabaseClient } from '../db/client.js';
import { users } from '../db/schema.js';
import { createDrizzleAuthSessionService } from '../modules/auth/authSessionService.js';
import { createDrizzleTeamService } from '../modules/teams/teamService.js';
import { createDrizzleUserRepository } from '../modules/users/userRepository.js';
import type { CurrentUser } from '../modules/users/userTypes.js';

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase('postgres integration', () => {
  let client: DatabaseClient;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    client = createDatabaseClient();
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) await client.db.delete(users).where(inArray(users.id, createdUserIds));
    await client.close();
  });

  async function createUser(label: string): Promise<CurrentUser> {
    const repository = createDrizzleUserRepository(client.db);
    const user = await repository.upsertFromApple({
      appleUserId: `integration:${label}:${randomUUID()}`,
      nickname: label,
    });
    createdUserIds.push(user.id);
    return user;
  }

  it('rotates refresh sessions and revokes the previous session', async () => {
    const user = await createUser('session-user');
    const service = createDrizzleAuthSessionService(client.db);
    const first = await service.create(user.id);
    const rotated = await service.rotate(first.refreshToken);

    expect(await service.isActive(extractSessionId(first.accessToken), user.id)).toBe(false);
    expect(await service.isActive(extractSessionId(rotated.session.accessToken), user.id)).toBe(true);
  });

  it('keeps concurrent invite acceptance within the four-member team limit', async () => {
    const service = createDrizzleTeamService(client.db);
    const owner = await createUser('owner');
    const buddies = await Promise.all(Array.from({ length: 4 }, (_, index) => createUser(`buddy-${index}`)));
    await service.createTeam(owner, { name: '并发测试队' });
    const invites = await Promise.all(buddies.map(() => service.createInvite(owner)));
    const results = await Promise.allSettled(
      buddies.map((buddy, index) => service.acceptInvite(buddy, invites[index]!.token, {})),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
    const team = await service.getCurrentTeam(owner);
    expect(team.team?.members).toHaveLength(4);
  });
});

function extractSessionId(token: string) {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Invalid JWT.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).sessionId as string;
}

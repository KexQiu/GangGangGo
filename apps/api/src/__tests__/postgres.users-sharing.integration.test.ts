import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';

import type { DatabaseClient } from '../db/client.js';
import { subscriptions } from '../db/schema.js';
import { createDrizzleEntitlementsService } from '../modules/entitlements/entitlementsService.js';
import { createDrizzleTeamService } from '../modules/teams/teamService.js';
import { createDrizzleUserRepository } from '../modules/users/userRepository.js';
import {
  addDaysToDateKey,
  cleanupIntegrationUsers,
  createIntegrationDatabaseClient,
  createIntegrationUser,
  describeWithDatabase,
} from './postgresTestUtils.js';

describeWithDatabase('postgres user, entitlement, and sharing integration', () => {
  let client: DatabaseClient;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    client = createIntegrationDatabaseClient();
  });

  afterAll(async () => {
    await cleanupIntegrationUsers(client, createdUserIds);
  });

  it('upserts Apple users and preserves profile updates', async () => {
    const repository = createDrizzleUserRepository(client.db);
    const appleUserId = `integration:user-upsert:${randomUUID()}`;
    const created = await repository.upsertFromApple({ appleUserId, nickname: '初始昵称' });
    createdUserIds.push(created.id);
    const upserted = await repository.upsertFromApple({ appleUserId, nickname: '更新昵称' });

    expect(upserted).toMatchObject({ id: created.id, nickname: '更新昵称' });

    const updated = await repository.updateProfile(created.id, {
      avatarUrl: { background: 'mint', emoji: 'calm' },
      nickname: null,
      timezone: 'America/Los_Angeles',
    });
    expect(updated).toMatchObject({
      avatarUrl: { background: 'mint', emoji: 'calm' },
      id: created.id,
      nickname: null,
      timezone: 'America/Los_Angeles',
    });
    expect(await repository.findById(created.id)).toEqual(updated);
  });

  it('reads active and expired entitlement states from Postgres', async () => {
    const user = await createIntegrationUser(client, createdUserIds, 'entitlement-user');
    const service = createDrizzleEntitlementsService(client.db);

    expect(await service.getEntitlements(user)).toEqual({ proStatus: 'free' });

    const [subscription] = await client.db
      .insert(subscriptions)
      .values({
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
        originalTransactionId: `integration-${randomUUID()}`,
        productId: 'xiaotidu.pro.monthly',
        status: 'active',
        userId: user.id,
      })
      .returning({ id: subscriptions.id });
    expect(await service.getEntitlements(user)).toEqual({ proStatus: 'pro_active' });

    await client.db
      .update(subscriptions)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(subscriptions.id, subscription!.id));
    expect(await service.getEntitlements(user)).toEqual({ proStatus: 'pro_expired' });
  });

  it('applies share permissions and filters daily snapshots by date', async () => {
    const service = createDrizzleTeamService(client.db);
    const owner = await createIntegrationUser(client, createdUserIds, 'share-owner');
    const buddy = await createIntegrationUser(client, createdUserIds, 'share-buddy');
    await service.createTeam(owner, { name: '共享权限队' });
    const invite = await service.createInvite(owner);
    await service.acceptInvite(buddy, invite.token, {});

    const date = new Date().toISOString().slice(0, 10);
    await service.upsertDailyShareSnapshot(owner, {
      date,
      habitCompletion: 4,
      streakDays: 9,
      toiletRecorded: true,
      trainingDone: true,
    });
    await service.updateShareSettings(owner, {
      paused: false,
      shareHabitCompletion: false,
      shareStreak: false,
      shareToiletRecorded: true,
      shareTraining: false,
    });

    const visible = await service.getCurrentTeamSnapshots(buddy, date);
    const ownerSnapshot = visible.snapshots.find((item) => item.member.user.id === owner.id)?.snapshot;
    expect(ownerSnapshot).toEqual({ date, toiletRecorded: true });

    const otherDate = await service.getCurrentTeamSnapshots(buddy, addDaysToDateKey(date, -1));
    expect(otherDate.snapshots.find((item) => item.member.user.id === owner.id)?.snapshot).toBeNull();

    await service.updateShareSettings(owner, {
      paused: true,
      shareHabitCompletion: true,
      shareStreak: true,
      shareToiletRecorded: true,
      shareTraining: true,
    });
    const paused = await service.getCurrentTeamSnapshots(buddy, date);
    expect(paused.snapshots.find((item) => item.member.user.id === owner.id)?.snapshot).toBeNull();
  });
});

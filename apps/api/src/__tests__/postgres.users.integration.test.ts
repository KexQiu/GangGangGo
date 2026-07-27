import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';

import type { DatabaseClient } from '../db/client.js';
import { subscriptions } from '../db/schema.js';
import { createDrizzleEntitlementsService } from '../modules/entitlements/entitlementsService.js';
import { createDrizzleUserRepository } from '../modules/users/userRepository.js';
import {
  cleanupIntegrationUsers,
  createIntegrationDatabaseClient,
  createIntegrationUser,
  createQueryCounter,
  describeWithDatabase,
} from './postgresTestUtils.js';

describeWithDatabase('postgres user and entitlement integration', () => {
  let client: DatabaseClient;
  const createdUserIds: string[] = [];
  const queryCounter = createQueryCounter();

  beforeAll(() => {
    client = createIntegrationDatabaseClient(queryCounter);
  });

  afterAll(async () => {
    await cleanupIntegrationUsers(client, createdUserIds);
  });

  it('upserts Apple users and preserves profile updates', async () => {
    const repository = createDrizzleUserRepository(client.db);
    const appleUserId = `integration:user-upsert:${randomUUID()}`;
    const created = await repository.upsertFromApple({ appleUserId, nickname: '初始昵称' });
    createdUserIds.push(created.id);
    queryCounter.reset();
    const upserted = await repository.upsertFromApple({ appleUserId, nickname: '更新昵称' });

    expect(upserted).toMatchObject({ id: created.id, nickname: '更新昵称' });
    expect(queryCounter.queries()).toHaveLength(1);
    expect(queryCounter.queries()[0]).toContain(
      'on conflict ("apple_user_id") where "users"."deleted_at" is null do update',
    );

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

    expect(await service.getEntitlements(user)).toEqual(growthEntitlements('free'));

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
    expect(await service.getEntitlements(user)).toEqual(growthEntitlements('pro_active'));

    await client.db
      .update(subscriptions)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(subscriptions.id, subscription!.id));
    expect(await service.getEntitlements(user)).toEqual(growthEntitlements('pro_expired'));
  });
});

function growthEntitlements(proStatus: 'free' | 'pro_active' | 'pro_expired') {
  return {
    commercialMode: 'growth_free',
    features: {
      advancedReport: true,
      reportSnapshotSync: true,
      watchActions: true,
    },
    proStatus,
  } as const;
}

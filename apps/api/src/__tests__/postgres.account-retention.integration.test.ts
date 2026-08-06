import { randomUUID } from 'node:crypto';

import { and, eq, lt } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';

import type { DatabaseClient } from '../db/client.js';
import { authSessions, growthEvents, pushTokens, syncedTrainingSessions } from '../db/schema.js';
import { purgeExpiredData } from '../modules/storage/retentionService.js';
import { createDrizzleAccountDataService } from '../modules/users/accountDataService.js';
import { createDrizzleUserRepository } from '../modules/users/userRepository.js';
import {
  cleanupIntegrationUsers,
  createIntegrationDatabaseClient,
  createIntegrationUser,
  describeWithDatabase,
} from './postgresTestUtils.js';

describeWithDatabase('postgres account and retention integration', () => {
  let client: DatabaseClient;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    client = createIntegrationDatabaseClient();
  });

  afterAll(async () => {
    await cleanupIntegrationUsers(client, createdUserIds);
  });

  it('exports portable data, purges expired rows, and permanently deletes the account', async () => {
    const user = await createIntegrationUser(client, createdUserIds, 'account-retention');
    const now = new Date();
    const expiredAt = new Date(now.getTime() - 1_000);
    const currentExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
    const oldGrowthReceivedAt = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1_000);
    const pushToken = `ExponentPushToken[${randomUUID()}]`;

    await client.db.insert(authSessions).values([
      {
        expiresAt: expiredAt,
        refreshTokenHash: `expired-${randomUUID()}`,
        userId: user.id,
      },
      {
        expiresAt: currentExpiry,
        refreshTokenHash: `active-${randomUUID()}`,
        userId: user.id,
      },
    ]);
    await client.db.insert(syncedTrainingSessions).values([
      {
        completedRepetitions: 5,
        discomfortReported: false,
        durationSeconds: 60,
        endedAt: now,
        expiresAt: expiredAt,
        isCompleted: true,
        localDate: now.toISOString().slice(0, 10),
        presetId: 'quick',
        recordId: `expired-${randomUUID()}`,
        startedAt: new Date(now.getTime() - 60_000),
        userId: user.id,
      },
      {
        completedRepetitions: 8,
        discomfortReported: false,
        durationSeconds: 90,
        endedAt: now,
        expiresAt: currentExpiry,
        isCompleted: true,
        localDate: now.toISOString().slice(0, 10),
        presetId: 'standard',
        recordId: `active-${randomUUID()}`,
        startedAt: new Date(now.getTime() - 90_000),
        userId: user.id,
      },
    ]);
    await client.db.insert(growthEvents).values([
      {
        appVersion: '0.2.0',
        eventId: `old-${randomUUID()}`,
        eventName: 'old_event',
        installationId: `installation-${randomUUID()}`,
        occurredAt: oldGrowthReceivedAt,
        platform: 'ios',
        receivedAt: oldGrowthReceivedAt,
        userId: user.id,
      },
      {
        appVersion: '0.2.0',
        eventId: `current-${randomUUID()}`,
        eventName: 'current_event',
        installationId: `installation-${randomUUID()}`,
        occurredAt: now,
        platform: 'ios',
        receivedAt: now,
        userId: user.id,
      },
    ]);
    await client.db.insert(pushTokens).values({
      platform: 'ios',
      token: pushToken,
      userId: user.id,
    });

    const accountService = createDrizzleAccountDataService(client.db);
    const exported = await accountService.exportAccountData(user);
    expect(exported.data.trainingSessions).toHaveLength(2);
    expect(exported.data.growthEvents).toHaveLength(2);
    expect(exported.data.pushRegistrations).toHaveLength(1);
    expect(JSON.stringify(exported)).not.toContain(pushToken);
    expect(JSON.stringify(exported)).not.toContain('refreshTokenHash');

    const purged = await purgeExpiredData(client.db, now);
    expect(purged.authSessions).toBeGreaterThanOrEqual(1);
    expect(purged.growthEvents).toBeGreaterThanOrEqual(1);
    expect(
      await client.db
        .select()
        .from(syncedTrainingSessions)
        .where(and(eq(syncedTrainingSessions.userId, user.id), lt(syncedTrainingSessions.expiresAt, now))),
    ).toEqual([]);

    const afterPurge = await accountService.exportAccountData(user);
    expect(afterPurge.data.trainingSessions).toHaveLength(1);
    expect(afterPurge.data.growthEvents).toHaveLength(1);

    await accountService.deleteAccount(user.id);
    expect(await createDrizzleUserRepository(client.db).findById(user.id)).toBeNull();
    expect(await client.db.select().from(growthEvents).where(eq(growthEvents.userId, user.id))).toEqual([]);
  });
});

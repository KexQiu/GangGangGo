import { randomUUID } from 'node:crypto';

import type { DataSyncMutation } from '@xiaotidu/contracts';
import { afterAll, beforeAll, expect, it } from 'vitest';

import type { DatabaseClient } from '../db/client.js';
import { createDrizzleDataSyncService } from '../modules/dataSync/dataSyncService.js';
import { createDrizzleFriendService } from '../modules/friends/friendService.js';
import {
  cleanupIntegrationUsers,
  createIntegrationDatabaseClient,
  createIntegrationUser,
  describeWithDatabase,
} from './postgresTestUtils.js';

describeWithDatabase('postgres friend and data sync integration', () => {
  let client: DatabaseClient;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    client = createIntegrationDatabaseClient();
  });

  afterAll(async () => {
    await cleanupIntegrationUsers(client, createdUserIds);
  });

  it('persists friendship permissions, synced summaries, nudges, and acknowledgements', async () => {
    const owner = await createIntegrationUser(client, createdUserIds, 'friend-owner');
    const viewer = await createIntegrationUser(client, createdUserIds, 'friend-viewer');
    const friendService = createDrizzleFriendService(client.db);
    const dataSyncService = createDrizzleDataSyncService(client.db, { friendService });
    const invite = await friendService.createInvite(owner);

    await friendService.acceptInvite(viewer, invite.token);
    await friendService.updateSettings(owner, viewer.id, { historyDays: 7, trainingLevel: 'detailed' });

    const now = new Date();
    const endedAt = now.toISOString();
    const startedAt = new Date(now.getTime() - 120_000).toISOString();
    const localDate = endedAt.slice(0, 10);
    const mutation: DataSyncMutation = {
      changedAt: endedAt,
      entityId: `training-${randomUUID()}`,
      entityType: 'training_session',
      mutationId: `mutation-${randomUUID()}`,
      operation: 'upsert',
      payload: {
        completedRepetitions: 12,
        discomfortReported: false,
        durationSeconds: 120,
        endedAt,
        isCompleted: true,
        localDate,
        presetId: 'quick',
        startedAt,
      },
    };

    const pushed = await dataSyncService.push(owner, [mutation], owner.timezone);
    const pulled = await dataSyncService.pull(owner, '0');
    const shared = await friendService.getFriendData(viewer, owner.id);

    expect(pushed.acceptedMutationIds).toEqual([mutation.mutationId]);
    expect(pulled.changes).toHaveLength(1);
    expect(shared.historyDays).toBe(7);
    expect(shared.days.at(-1)?.training).toMatchObject({
      completedRepetitions: 12,
      completedSessionCount: 1,
      level: 'detailed',
    });

    const event = await friendService.sendNudge(viewer, owner.id, { type: 'move' });
    const ack = await friendService.ackNudge(owner, event.id, 'received');
    const timeline = await friendService.listEvents(viewer, owner.id, { limit: 30 });

    expect(ack.ack.status).toBe('received');
    expect(timeline.events[0]).toMatchObject({ ack: { status: 'received' }, id: event.id });
  });

  it('preserves no bowel movement in cloud records and authorized daily summaries', async () => {
    const owner = await createIntegrationUser(client, createdUserIds, 'bowel-owner');
    const viewer = await createIntegrationUser(client, createdUserIds, 'bowel-viewer');
    const friends = createDrizzleFriendService(client.db);
    const sync = createDrizzleDataSyncService(client.db, { friendService: friends });
    const invite = await friends.createInvite(owner);
    await friends.acceptInvite(viewer, invite.token);
    await friends.updateSettings(owner, viewer.id, { historyDays: 7, habitLevel: 'detailed' });
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const payload = {
      date,
      bowel: 'not_today' as const,
      water: 'low' as const,
      fiber: 'medium' as const,
      movement: 'good' as const,
    };
    await sync.push(
      owner,
      [
        {
          changedAt: now.toISOString(),
          entityId: date,
          entityType: 'habit_checkin',
          mutationId: randomUUID(),
          operation: 'upsert',
          payload,
        },
      ],
      owner.timezone,
    );
    expect((await sync.pull(owner, '0')).changes[0]?.payload).toEqual(payload);
    const shared = await friends.getFriendData(viewer, owner.id);
    expect(shared.days.find((day) => day.date === date)?.habit).toMatchObject({
      level: 'detailed',
      bowel: 'not_today',
      completionCount: 4,
    });
  });
});

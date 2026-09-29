import { createDefaultTrainingPreferences } from '@xiaotidu/contracts';
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

  it('shares partial training as recorded while keeping preferences and symptoms private', async () => {
    const owner = await createIntegrationUser(client, createdUserIds, 'partial-owner');
    const viewer = await createIntegrationUser(client, createdUserIds, 'partial-viewer');
    const friends = createDrizzleFriendService(client.db);
    const sync = createDrizzleDataSyncService(client.db, { friendService: friends });
    const invite = await friends.createInvite(owner);
    await friends.acceptInvite(viewer, invite.token);
    await friends.updateSettings(owner, viewer.id, { historyDays: 7, trainingLevel: 'detailed' });
    const now = new Date().toISOString();
    const preferences = createDefaultTrainingPreferences();
    preferences.dailyTarget = 2;
    const result = await sync.push(
      owner,
      [
        {
          mutationId: randomUUID(),
          entityId: 'preferences',
          entityType: 'training_preferences',
          operation: 'upsert',
          changedAt: now,
          payload: preferences,
        },
        {
          mutationId: randomUUID(),
          entityId: randomUUID(),
          entityType: 'training_session',
          operation: 'upsert',
          changedAt: now,
          payload: {
            presetId: 'beginner',
            startedAt: now,
            endedAt: now,
            localDate: now.slice(0, 10),
            durationSeconds: 7,
            completedRepetitions: 1,
            isCompleted: false,
            feedback: 'reported',
            endReason: 'discomfort',
            plan: { contractSeconds: 1, relaxSeconds: 6, repetitions: 2 },
          },
        },
      ],
      owner.timezone,
    );
    expect(result.acceptedMutationIds).toHaveLength(2);
    const shared = await friends.getFriendData(viewer, owner.id);
    expect(shared.days.at(-1)?.training).toEqual({
      level: 'detailed',
      trainingRecorded: true,
      sessionCount: 1,
      completedSessionCount: 0,
      completedRepetitions: 1,
      totalDurationSeconds: 7,
    });
    const serialized = JSON.stringify(shared);
    for (const privateField of ['feedback', 'endReason', 'dailyTarget', 'contractSeconds'])
      expect(serialized).not.toContain(privateField);
    await friends.updateSettings(owner, viewer.id, { trainingLevel: 'summary' });
    expect((await friends.getFriendData(viewer, owner.id)).days.at(-1)?.training).toEqual({
      level: 'summary',
      trainingRecorded: true,
    });
    expect(
      (await sync.pull(owner, '0')).changes.find((change) => change.entityType === 'training_preferences')?.payload,
    ).toEqual(preferences);
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
        feedback: 'unanswered' as const,
        endReason: 'completed' as const,
        plan: { contractSeconds: 5, relaxSeconds: 5, repetitions: 12 },
        durationSeconds: 120,
        endedAt,
        isCompleted: true,
        localDate,
        presetId: 'standard',
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
      sessionCount: 1,
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

import { randomUUID } from 'node:crypto';

import type { DataSyncMutation } from '@xiaotidu/contracts';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import type { DatabaseClient } from '../db/client.js';
import { createDrizzleDataSyncService } from '../modules/dataSync/dataSyncService.js';
import {
  cleanupIntegrationUsers,
  createIntegrationDatabaseClient,
  createIntegrationUser,
  describeWithDatabase,
} from './postgresTestUtils.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function mutation(daysAgo: number): DataSyncMutation {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return {
    changedAt: date.toISOString(),
    entityId: `training-${randomUUID()}`,
    entityType: 'training_session',
    mutationId: randomUUID(),
    operation: 'upsert',
    payload: {
      completedRepetitions: 12,
      discomfortReported: false,
      durationSeconds: 120,
      endedAt: date.toISOString(),
      isCompleted: true,
      localDate: date.toISOString().slice(0, 10),
      presetId: 'quick',
      startedAt: new Date(date.getTime() - 120_000).toISOString(),
    },
  };
}

// Execute the real service transaction, but hold its commit after all SQL has run.
function holdCommit(client: DatabaseClient, rollback = false) {
  const entered = deferred();
  const release = deferred();
  const transaction = client.db.transaction.bind(client.db);
  client.db.transaction = (operation, config) =>
    transaction(async (tx) => {
      const result = await operation(tx);
      entered.resolve();
      await release.promise;
      if (rollback) throw new Error('injected rollback');
      return result;
    }, config);
  return { entered: entered.promise, release: release.resolve };
}

describeWithDatabase('postgres sync cursor under concurrent commits', () => {
  let observer: DatabaseClient;
  const userIds: string[] = [];
  beforeAll(() => {
    observer = createIntegrationDatabaseClient();
  });
  afterAll(async () => {
    await cleanupIntegrationUsers(observer, userIds);
  });

  it.each([false, true])(
    'does not skip a held transaction (rollback=%s)',
    async (rollback) => {
      const owner = await createIntegrationUser(observer, userIds, 'ordering');
      const first = createIntegrationDatabaseClient();
      const second = createIntegrationDatabaseClient();
      const gate = holdCommit(first, rollback);
      const firstMutation = mutation(2);
      const secondMutation = mutation(1); // Different summary rows must not serialize this test.
      const reader = createDrizzleDataSyncService(observer.db);
      const firstPush = createDrizzleDataSyncService(first.db).push(owner, [firstMutation], 'UTC');
      // Attach rejection handling immediately, including the deliberately rolled-back case.
      const firstResult = firstPush.then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      let secondPid = 0;
      let secondFinished = false;
      const transaction = second.db.transaction.bind(second.db);
      second.db.transaction = (operation, config) =>
        transaction(async (tx) => {
          const { sql } = await import('drizzle-orm');
          const rows = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
          secondPid = rows[0]!.pid;
          return operation(tx);
        }, config);
      let secondPush: ReturnType<typeof reader.push> | undefined;
      try {
        await gate.entered;
        secondPush = createDrizzleDataSyncService(second.db)
          .push(owner, [secondMutation], 'UTC')
          .then((value) => {
            secondFinished = true;
            return value;
          });
        // Observe actual database blocking, not an arbitrary sleep that might mask the race.
        await vi.waitFor(
          async () => {
            const rows = await observer.sql<{ wait_event_type: string | null }[]>`
          select wait_event_type from pg_stat_activity where pid = ${secondPid}`;
            expect(secondFinished || rows[0]?.wait_event_type === 'Lock').toBe(true);
          },
          { timeout: 5000, interval: 10 },
        );
        const beforeCommit = await reader.pull(owner, '0');
        gate.release();
        const firstOutcome = await firstResult;
        const secondOutcome = await secondPush;
        const afterCommit = await reader.pull(owner, beforeCommit.nextCursor);
        const received = [...beforeCommit.changes, ...afterCommit.changes];

        expect(received.map((change) => change.entityId).sort()).toEqual(
          (rollback ? [secondMutation.entityId] : [firstMutation.entityId, secondMutation.entityId]).sort(),
        );
        if (rollback) expect(firstOutcome).toHaveProperty('error');
        else {
          expect(beforeCommit.changes).toEqual([]);
          expect(firstOutcome).toHaveProperty('value');
          const versions = received.map((change) => change.version);
          expect(versions).toEqual([...versions].sort((a, b) => a - b));
        }
        // A retried mutation is acknowledged once and does not create a new change.
        const retry = await reader.push(owner, [secondMutation], 'UTC');
        expect(retry.changes).toEqual(secondOutcome.changes);
        expect((await reader.pull(owner, afterCommit.nextCursor)).changes).toEqual([]);
      } finally {
        gate.release();
        await Promise.allSettled([firstResult, secondPush]);
        await Promise.all([first.close(), second.close()]);
      }
    },
    15_000,
  );

  it('allows another user to commit while one user is held', async () => {
    const owner = await createIntegrationUser(observer, userIds, 'held-owner');
    const other = await createIntegrationUser(observer, userIds, 'other-owner');
    const writer = createIntegrationDatabaseClient();
    const gate = holdCommit(writer);
    const pending = createDrizzleDataSyncService(writer.db).push(owner, [mutation(2)], 'UTC');
    try {
      await gate.entered;
      const service = createDrizzleDataSyncService(observer.db);
      await service.push(other, [mutation(1)], 'UTC');
      expect((await service.pull(other, '0')).changes).toHaveLength(1);
      expect((await service.pull(owner, '0')).changes).toEqual([]);
    } finally {
      gate.release();
      await pending;
      await writer.close();
    }
  }, 15_000);
});

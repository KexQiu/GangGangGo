import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSyncPullResponse, DataSyncPushResponse } from '@xiaotidu/contracts';
import { authSessionContext } from '../../../api/sessionContext';
import { runMigrations } from '../../../storage/migrations';
import { bindActiveLocalProfileToUser, restoreLocalProfile } from '../../../storage/localDataProfile';
import { syncCompleteHealthData } from '../fullDataSync';
import { readDataSyncOverview } from '../../../storage/dataSyncOutbox';

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  push: vi.fn(),
  pull: vi.fn(),
  hydrate: vi.fn(),
  reset: vi.fn(),
  rebuild: vi.fn(),
}));
vi.mock('../../../api/client', () => ({ dataSyncApi: { push: mocks.push, pull: mocks.pull } }));
vi.mock('../../../storage/db', () => ({ initializeDatabase: mocks.db }));
vi.mock('../../data/dailyData', () => ({ rebuildDailySummary: mocks.rebuild }));
vi.mock('../../growth/growthEventTracker', () => ({ trackGrowthEvent: vi.fn() }));
vi.mock('../../habits/habitStore', () => ({
  useHabitStore: { getState: () => ({ hydrate: mocks.hydrate, reset: mocks.reset }) },
}));
vi.mock('../../toilet/toiletStore', () => ({
  useToiletStore: { getState: () => ({ hydrate: mocks.hydrate, reset: mocks.reset }) },
}));
vi.mock('../../training/trainingStore', () => ({
  useTrainingStore: { getState: () => ({ hydrate: mocks.hydrate, reset: mocks.reset }) },
}));

let database: DatabaseSync;
let adapter: ReturnType<typeof createAdapter>;
const date = '2026-09-28';
const timestamp = `${date}T12:00:00.000Z`;

beforeEach(async () => {
  vi.resetAllMocks();
  authSessionContext.beginTransition();
  database = new DatabaseSync(':memory:');
  adapter = createAdapter();
  mocks.db.mockResolvedValue(adapter);
  await runMigrations(adapter as unknown as SQLiteDatabase);
  database.exec(`
    INSERT INTO local_data_profiles (id, user_id, created_at, updated_at) VALUES
      ('profile-A', 'A', '${timestamp}', '${timestamp}'), ('profile-B', 'B', '${timestamp}', '${timestamp}');
  `);
  activate('A');
  mocks.pull.mockResolvedValue(pullResponse());
  mocks.push.mockImplementation(async ({ mutations }) => ({
    acceptedMutationIds: mutations.map((mutation: { mutationId: string }) => mutation.mutationId),
    changes: [],
  }));
});
afterEach(() => database.close());

describe('complete sync session boundaries with SQLite', () => {
  it('counts every pending change in the current profile, not just the first upload page', async () => {
    seedOutbox('B');
    for (let index = 0; index < 105; index++)
      database
        .prepare(
          `INSERT INTO data_sync_outbox (mutation_id, profile_id, entity_type, entity_id, operation, changed_at)
       VALUES (?, 'profile-A', 'habit_checkin', ?, 'delete', ?);`,
        )
        .run(`many-${index}`, date, timestamp);
    expect(await readDataSyncOverview('profile-A')).toEqual({ pendingCount: 105, lastCompletedAt: null });
    await syncCompleteHealthData();
    expect(await readDataSyncOverview('profile-A')).toMatchObject({
      pendingCount: 0,
      lastCompletedAt: expect.any(String),
    });
    expect(await readDataSyncOverview('profile-B')).toEqual({ pendingCount: 1, lastCompletedAt: null });
  });

  it('does not record completion when a later pull page fails, and retry completes the round', async () => {
    mocks.pull
      .mockResolvedValueOnce({ ...pullResponse(true), hasMore: true })
      .mockRejectedValueOnce(new Error('offline'));
    await expect(syncCompleteHealthData()).rejects.toThrow('offline');
    expect(rows('data_sync_state')).toMatchObject([{ cursor: '1', last_completed_at: null }]);
    await syncCompleteHealthData();
    const completed = (await readDataSyncOverview('profile-A')).lastCompletedAt;
    expect(completed).not.toBeNull();
    mocks.pull.mockRejectedValueOnce(new Error('offline again'));
    await expect(syncCompleteHealthData()).rejects.toThrow('offline again');
    expect((await readDataSyncOverview('profile-A')).lastCompletedAt).toBe(completed);
  });

  it('does not stamp completion if a new local change appears before the final transaction', async () => {
    mocks.hydrate.mockImplementationOnce(async () => seedOutbox('A'));
    expect(await syncCompleteHealthData()).toMatchObject({ outcome: 'skipped' });
    expect(await readDataSyncOverview('profile-A')).toEqual({ pendingCount: 1, lastCompletedAt: null });
    await syncCompleteHealthData();
    expect(await readDataSyncOverview('profile-A')).toMatchObject({
      pendingCount: 0,
      lastCompletedAt: expect.any(String),
    });
  });

  it('surfaces sync-status read errors instead of reporting zero pending changes', async () => {
    const read = adapter.getFirstAsync;
    adapter.getFirstAsync = async () => {
      throw new Error('SQLite unavailable');
    };
    await expect(readDataSyncOverview('profile-A')).rejects.toThrow('SQLite unavailable');
    adapter.getFirstAsync = read;
    expect(await readDataSyncOverview('profile-A')).toEqual({ pendingCount: 0, lastCompletedAt: null });
  });

  it.each(['write failure', 'account change'] as const)(
    'does not persist completion on %s in the final transaction',
    async (failure) => {
      const run = adapter.runAsync.getMockImplementation()!;
      adapter.runAsync.mockImplementation(async (sql, params) => {
        const result = await run(sql, params);
        if (sql.includes('last_completed_at')) {
          if (failure === 'write failure') throw new Error('disk full');
          authSessionContext.beginTransition();
        }
        return result;
      });
      if (failure === 'write failure') await expect(syncCompleteHealthData()).rejects.toThrow('disk full');
      else await expect(syncCompleteHealthData()).resolves.toMatchObject({ outcome: 'skipped' });
      expect(rows('data_sync_state')).toMatchObject([{ last_completed_at: null }]);
    },
  );
  it.each([
    ['A', 'B'],
    ['B', 'A'],
  ])('does not send %s outbox after switching to %s while reading records', async (oldUser, newUser) => {
    activate(oldUser);
    seedOutbox(oldUser);
    seedOutbox(newUser);
    const reading = deferred<void>();
    const read = adapter.getAllAsync.getMockImplementation()!;
    adapter.getAllAsync.mockImplementationOnce(async (sql, params) => {
      await reading.promise;
      return read(sql, params);
    });
    const syncing = syncCompleteHealthData();
    await vi.waitFor(() => expect(adapter.getAllAsync).toHaveBeenCalled());
    activate(newUser);
    reading.resolve();
    await expect(syncing).resolves.toMatchObject({ outcome: 'skipped' });
    expect(mocks.push).not.toHaveBeenCalled();
    expect(rows('data_sync_outbox')).toHaveLength(2);
  });

  it('preserves the old outbox when its push response arrives after switching', async () => {
    seedOutbox('A');
    const pending = deferred<DataSyncPushResponse>();
    mocks.push.mockReturnValue(pending.promise);
    const syncing = syncCompleteHealthData();
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
    expect(mocks.push.mock.calls[0][1]).toBe('A');
    activate('B');
    pending.resolve({ acceptedMutationIds: ['mutation-A'], changes: [] });
    await expect(syncing).resolves.toMatchObject({ outcome: 'skipped' });
    expect(rows('data_sync_outbox')).toHaveLength(1);
    expect(mocks.pull).not.toHaveBeenCalled();
    expect(mocks.hydrate).not.toHaveBeenCalled();
  });

  it('discards old pull changes and cursor after switching', async () => {
    const pending = deferred<DataSyncPullResponse>();
    mocks.pull.mockReturnValue(pending.promise);
    const syncing = syncCompleteHealthData();
    await vi.waitFor(() => expect(mocks.pull).toHaveBeenCalledOnce());
    activate('B');
    pending.resolve(pullResponse(true));
    await expect(syncing).resolves.toMatchObject({ outcome: 'skipped' });
    expect(rows('habit_checkins')).toHaveLength(0);
    expect(rows('data_sync_state')).toHaveLength(0);
    expect(mocks.hydrate).not.toHaveBeenCalled();
  });

  it('continues applying the same owner response after token rotation', async () => {
    seedOutbox('A');
    mocks.push.mockImplementationOnce(async () => {
      authSessionContext.activate({ ...authSessionContext.current()!, accessToken: 'A-rotated' });
      return { acceptedMutationIds: ['mutation-A'], changes: [] };
    });
    mocks.pull.mockResolvedValue(pullResponse(true));
    await expect(syncCompleteHealthData()).resolves.toEqual({ outcome: 'success' });
    expect(rows('data_sync_outbox')).toHaveLength(0);
    expect(rows('habit_checkins')).toMatchObject([{ profile_id: 'profile-A', water: 'good' }]);
    expect(rows('data_sync_state')).toMatchObject([{ profile_id: 'profile-A', cursor: '1' }]);
  });

  it('pauses cloud sync while an identity transition has no published owner', async () => {
    seedOutbox('A');
    authSessionContext.beginTransition();
    await expect(syncCompleteHealthData()).resolves.toMatchObject({ outcome: 'skipped' });
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.pull).not.toHaveBeenCalled();
  });

  it('finishes an in-flight A database write before B changes the active profile', async () => {
    mocks.pull.mockResolvedValue(pullResponse(true));
    const writing = deferred<void>();
    let entered = false;
    const run = adapter.runAsync.getMockImplementation()!;
    adapter.runAsync.mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO habit_checkins')) {
        entered = true;
        await writing.promise;
      }
      return run(sql, params);
    });
    const syncing = syncCompleteHealthData();
    await vi.waitFor(() => expect(entered).toBe(true));
    const generation = authSessionContext.beginTransition();
    const switching = authSessionContext.runExclusive(generation, async () => {
      await restoreLocalProfile('profile-B', 'B', () => authSessionContext.assertGeneration(generation));
      authSessionContext.activate({ generation, userId: 'B', profileId: 'profile-B', accessToken: 'B' });
    });
    expect(activeProfile()).toBe('profile-A');
    writing.resolve();
    await Promise.all([syncing, switching]);
    expect(activeProfile()).toBe('profile-B');
    expect(rows('habit_checkins')).toMatchObject([{ profile_id: 'profile-A' }]);
    expect(rows('data_sync_state')).toMatchObject([{ profile_id: 'profile-A', cursor: '1' }]);
    expect(mocks.hydrate).not.toHaveBeenCalled();
  });

  it('rolls back claiming anonymous data if a login becomes stale inside the transaction', async () => {
    database.exec("UPDATE app_metadata SET value = 'local-default' WHERE key = 'active_profile_id'");
    const generation = authSessionContext.beginTransition();
    const run = adapter.runAsync.getMockImplementation()!;
    adapter.runAsync.mockImplementation(async (sql, params) => {
      const result = await run(sql, params);
      if (sql.includes('UPDATE local_data_profiles SET user_id')) authSessionContext.beginTransition();
      return result;
    });
    await expect(
      bindActiveLocalProfileToUser('C', () => authSessionContext.assertGeneration(generation)),
    ).rejects.toMatchObject({ code: 'session_changed' });
    expect(activeProfile()).toBe('local-default');
    expect(
      database.prepare("SELECT user_id FROM local_data_profiles WHERE id = 'local-default'").get()?.user_id,
    ).toBeNull();
  });

  it('rejects a stored token/profile owner mismatch without changing the active profile', async () => {
    await expect(restoreLocalProfile('profile-A', 'B', () => undefined)).rejects.toThrow('本地账号资料不匹配');
    expect(activeProfile()).toBe('profile-A');
  });
});

function activate(userId: string) {
  const generation = authSessionContext.beginTransition();
  database.prepare("UPDATE app_metadata SET value = ? WHERE key = 'active_profile_id'").run(`profile-${userId}`);
  authSessionContext.activate({ generation, userId, profileId: `profile-${userId}`, accessToken: userId });
}
function activeProfile() {
  return database.prepare("SELECT value FROM app_metadata WHERE key = 'active_profile_id'").get()?.value;
}
function seedOutbox(userId: string) {
  database
    .prepare(
      `INSERT INTO data_sync_outbox (mutation_id, profile_id, entity_type, entity_id, operation, payload_json, changed_at) VALUES (?, ?, 'habit_checkin', ?, 'delete', NULL, ?)`,
    )
    .run(`mutation-${userId}`, `profile-${userId}`, date, timestamp);
}
function rows(table: string) {
  return database.prepare(`SELECT * FROM ${table}`).all();
}
function pullResponse(withChange = false): DataSyncPullResponse {
  return {
    changes: withChange
      ? [
          {
            entityId: date,
            entityType: 'habit_checkin',
            operation: 'upsert',
            payload: { date, bowel: null, fiber: null, movement: null, water: 'good' },
            serverUpdatedAt: timestamp,
            version: 1,
          },
        ]
      : [],
    hasMore: false,
    nextCursor: withChange ? '1' : '0',
    resetRequired: false,
  };
}
function createAdapter() {
  type Params = Record<string, SQLInputValue>;
  return {
    execAsync: async (sql: string) => {
      database.exec(sql);
    },
    getFirstAsync: async (sql: string, params: Params = {}) => database.prepare(sql).get(params) ?? null,
    getAllAsync: vi.fn(async (sql: string, params: Params = {}) => database.prepare(sql).all(params)),
    runAsync: vi.fn(async (sql: string, params: Params = {}) => database.prepare(sql).run(params)),
    withTransactionAsync: async (task: () => Promise<void>) => {
      database.exec('BEGIN');
      try {
        await task();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

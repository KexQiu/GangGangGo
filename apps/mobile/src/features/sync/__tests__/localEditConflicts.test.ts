import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSyncChange, DataSyncMutation, DataSyncPullResponse, DataSyncPushRequest } from '@xiaotidu/contracts';

import { authSessionContext } from '../../../api/sessionContext';
import { getDataSyncCursor } from '../../../storage/dataSyncOutbox';
import { runMigrations } from '../../../storage/migrations';
import { createToiletSignalPreset, deleteToiletSignalPreset } from '../../../storage/repositories/toiletRepository';
import { getLocalDateKey } from '../../habits/habitLogic';
import { useHabitStore } from '../../habits/habitStore';
import { useToiletStore } from '../../toilet/toiletStore';
import type { ToiletSession } from '../../toilet/toiletTypes';
import { useTrainingStore } from '../../training/trainingStore';
import { syncCompleteHealthData } from '../fullDataSync';

const mocks = vi.hoisted(() => ({ db: vi.fn(), push: vi.fn(), pull: vi.fn() }));
vi.mock('../../../storage/db', () => ({ initializeDatabase: mocks.db }));
vi.mock('../../../api/client', () => ({ dataSyncApi: { push: mocks.push, pull: mocks.pull } }));
vi.mock('../../growth/growthEventTracker', () => ({ trackGrowthEvent: vi.fn() }));

const date = getLocalDateKey();
const endedAt = new Date(`${date}T12:00:00`).toISOString();
const startedAt = new Date(Date.parse(endedAt) - 120_000).toISOString();
const training = {
  id: 'training-1',
  startedAt,
  endedAt,
  durationSeconds: 120,
  presetId: 'standard' as const,
  isCompleted: true,
  discomfortReported: false,
  completedRepetitions: 12,
};
const toilet: ToiletSession = {
  id: 'toilet-1',
  startedAt,
  endedAt,
  durationSeconds: 120,
  feeling: 'normal',
  bleeding: false,
  discomfort: false,
};
let database: DatabaseSync;
let changes: DataSyncChange[];
let accepted: Map<string, DataSyncChange>;
let writeHook: (sql: string) => Promise<void>;
let pageSize: number;

beforeEach(async () => {
  vi.clearAllMocks();
  changes = [];
  accepted = new Map();
  pageSize = 250;
  writeHook = async () => undefined;
  database = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async (sql: string) => {
      database.exec(sql);
    },
    runAsync: async (sql: string, params: Record<string, SQLInputValue> = {}) => {
      await writeHook(sql);
      return database.prepare(sql).run(params);
    },
    getFirstAsync: async (sql: string, params: Record<string, SQLInputValue> = {}) =>
      database.prepare(sql).get(params) ?? null,
    getAllAsync: async (sql: string, params: Record<string, SQLInputValue> = {}) => database.prepare(sql).all(params),
    withTransactionAsync: async (operation: () => Promise<void>) => {
      database.exec('BEGIN');
      try {
        await operation();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;
  mocks.db.mockResolvedValue(adapter);
  await runMigrations(adapter);
  database.exec(`INSERT INTO local_data_profiles (id, user_id, created_at, updated_at) VALUES ('profile-A', 'A', '${endedAt}', '${endedAt}');
    UPDATE app_metadata SET value = 'profile-A' WHERE key = 'active_profile_id';`);
  authSessionContext.activate({
    generation: authSessionContext.beginTransition(),
    userId: 'A',
    profileId: 'profile-A',
    accessToken: 'A',
  });
  useHabitStore.getState().reset();
  useToiletStore.getState().reset();
  useTrainingStore.getState().reset();
  mocks.push.mockImplementation(async (request: DataSyncPushRequest) => push(request));
  mocks.pull.mockImplementation(async (cursor: string) => pull(cursor));
});
afterEach(() => {
  database.close();
  vi.restoreAllMocks();
});

describe('local edits versus in-flight sync, with real SQLite repositories and stores', () => {
  it.each(['training_session', 'habit_checkin', 'toilet_session'] as const)(
    'protects pending %s against both remote updates and deletes, then converges',
    async (entityType) => {
      const entityId =
        entityType === 'habit_checkin' ? date : entityType === 'training_session' ? training.id : toilet.id;
      const payload =
        entityType === 'habit_checkin'
          ? habitPayload('low')
          : entityType === 'training_session'
            ? { ...withoutId(training), localDate: date, completedRepetitions: 1 }
            : {
                ...withoutId(toilet),
                localDate: date,
                durationSeconds: 10,
                signals: [],
                stoolShape: null,
                stoolColor: null,
              };
      remote({ entityType, entityId, operation: 'upsert', payload });
      remote({ entityType, entityId, operation: 'delete', payload: null });
      const gate = holdPull();
      const syncing = syncCompleteHealthData();
      await gate.started;
      if (entityType === 'habit_checkin') await useHabitStore.getState().setHabitLevel(date, 'water', 'good');
      else if (entityType === 'training_session') await useTrainingStore.getState().addSession(training);
      else await useToiletStore.getState().addSession(toilet);
      const table =
        entityType === 'habit_checkin'
          ? 'habit_checkins'
          : entityType === 'training_session'
            ? 'training_sessions'
            : 'toilet_sessions';
      const before = rows(table);
      mocks.push.mockImplementationOnce(async (request: DataSyncPushRequest) => {
        expect(rows(table)).toEqual(before); // 旧 pull 返回后、补推开始前内容仍必须不变。
        expect(rows('data_sync_outbox')).toHaveLength(1);
        return push(request);
      });
      gate.release();
      await expect(syncing).resolves.toBe(true);
      expect(rows(table)).toMatchObject([{ deleted_at: null, sync_version: 3 }]);
      expect(rows('data_sync_outbox')).toHaveLength(0);
      expect(changes.at(-1)).toMatchObject({ entityType, entityId, operation: 'upsert' });
      if (entityType === 'habit_checkin') {
        expect(useHabitStore.getState().checkIns).toMatchObject([{ water: 'good' }]);
        expect(changes.at(-1)?.payload).toMatchObject({ water: 'good' });
      } else if (entityType === 'training_session') {
        expect(useTrainingStore.getState().sessions).toMatchObject([{ completedRepetitions: 12 }]);
      } else {
        expect(useToiletStore.getState().sessions).toMatchObject([{ durationSeconds: 120 }]);
      }
    },
  );

  it.each(['edit', 'delete'] as const)('preserves a toilet %s made after pull started', async (action) => {
    await useToiletStore.getState().addSession(toilet);
    await syncCompleteHealthData();
    remote({
      entityType: 'toilet_session',
      entityId: toilet.id,
      operation: 'upsert',
      payload: { ...withoutId(toilet), localDate: date, signals: [], stoolShape: null, stoolColor: null },
    });
    const gate = holdPull();
    const syncing = syncCompleteHealthData();
    await gate.started;
    if (action === 'edit')
      await useToiletStore.getState().updateSession({ ...toilet, feeling: 'difficult', durationSeconds: 300 });
    else await useToiletStore.getState().deleteSession(toilet.id);
    mocks.push.mockImplementationOnce(async (request: DataSyncPushRequest) => {
      expect(rows('toilet_sessions')[0]).toMatchObject(
        action === 'edit' ? { feeling: 'difficult', duration_seconds: 300 } : { deleted_at: expect.any(String) },
      );
      expect(useToiletStore.getState().sessions).toHaveLength(action === 'edit' ? 1 : 0);
      return push(request);
    });
    gate.release();
    await syncing;
    expect(rows('data_sync_outbox')).toHaveLength(0);
    expect(rows('daily_activity_summaries')[0]).toMatchObject({ toilet_session_count: action === 'edit' ? 1 : 0 });
    expect(changes.at(-1)?.operation).toBe(action === 'edit' ? 'upsert' : 'delete');
    expect(useToiletStore.getState().sessions).toHaveLength(action === 'edit' ? 1 : 0);
  });

  it('retains a newer local mutation while an older push acknowledgement is in flight', async () => {
    await useHabitStore.getState().setHabitLevel(date, 'water', 'medium');
    const responseGate = deferred();
    const started = deferred();
    mocks.push.mockImplementationOnce(async (request: DataSyncPushRequest) => {
      const response = push(request);
      started.resolve();
      await responseGate.promise;
      return response;
    });
    const syncing = syncCompleteHealthData();
    await started.promise;
    await useHabitStore.getState().setHabitLevel(date, 'water', 'good');
    const newestId = rows('data_sync_outbox').at(-1)?.mutation_id;
    mocks.push.mockImplementationOnce(async (request: DataSyncPushRequest) => {
      expect(request.mutations.map((mutation) => mutation.mutationId)).toEqual([newestId]);
      expect(rows('habit_checkins')[0]?.water).toBe('good');
      expect(useHabitStore.getState().checkIns[0]?.water).toBe('good');
      return push(request);
    });
    responseGate.resolve();
    await syncing;
    expect(changes.at(-1)?.payload).toMatchObject({ water: 'good' });
    expect(rows('habit_checkins')[0]).toMatchObject({ water: 'good', sync_version: 2 });
  });

  it('does not replay old cloud history over an acknowledged local edit between pull pages', async () => {
    pageSize = 1;
    remote({ entityType: 'habit_checkin', entityId: date, operation: 'upsert', payload: habitPayload('low') });
    await useHabitStore.getState().setHabitLevel(date, 'water', 'good');
    mocks.pull.mockImplementation(async (cursor: string) => {
      expect(rows('habit_checkins')[0]).toMatchObject({ water: 'good', sync_version: 2 });
      return pull(cursor);
    });
    await syncCompleteHealthData();
    expect(mocks.pull).toHaveBeenCalledTimes(2);
    expect(useHabitStore.getState().checkIns[0]?.water).toBe('good');
  });

  it('keeps a local edit and its outbox across network failure after skipping an old pull', async () => {
    remote({ entityType: 'habit_checkin', entityId: date, operation: 'upsert', payload: habitPayload('low') });
    const gate = holdPull();
    const syncing = syncCompleteHealthData();
    const failed = expect(syncing).rejects.toThrow('offline');
    await gate.started;
    await useHabitStore.getState().setHabitLevel(date, 'water', 'good');
    mocks.push.mockRejectedValueOnce(new Error('offline'));
    gate.release();
    await failed;
    expect(rows('habit_checkins')[0]?.water).toBe('good');
    expect(rows('data_sync_outbox')).toHaveLength(1);
    expect(await getDataSyncCursor('profile-A')).toBe('1');
    useHabitStore.getState().reset(); // 内存被清空后仍靠持久化 outbox 保护和补推。
    await syncCompleteHealthData();
    expect(rows('data_sync_outbox')).toHaveLength(0);
    expect(useHabitStore.getState().checkIns[0]?.water).toBe('good');
    expect(changes.at(-1)?.payload).toMatchObject({ water: 'good' });
  });

  it('atomically commits push ACK, server version and summary, retaining retry on disk failure', async () => {
    await useHabitStore.getState().setHabitLevel(date, 'water', 'good');
    failOnce('INSERT INTO daily_activity_summaries');
    await expect(syncCompleteHealthData()).rejects.toThrow('disk full');
    expect(rows('data_sync_outbox')).toHaveLength(1);
    expect(rows('habit_checkins')[0]).toMatchObject({ water: 'good', sync_version: 0 });
    await syncCompleteHealthData();
    expect(changes).toHaveLength(1); // 重发同一 mutation，服务端幂等。
    expect(rows('data_sync_outbox')).toHaveLength(0);
    expect(rows('habit_checkins')[0]?.sync_version).toBe(1);
  });

  it.each(['INSERT INTO daily_activity_summaries', 'INSERT INTO data_sync_state'])(
    'rolls back a pull page and cursor when %s fails',
    async (sql) => {
      remote({ entityType: 'habit_checkin', entityId: date, operation: 'upsert', payload: habitPayload('medium') });
      failOnce(sql);
      await expect(syncCompleteHealthData()).rejects.toThrow('disk full');
      expect(rows('habit_checkins')).toHaveLength(0);
      expect(rows('daily_activity_summaries')).toHaveLength(0);
      expect(await getDataSyncCursor('profile-A')).toBe('0');
      await syncCompleteHealthData();
      expect(useHabitStore.getState().checkIns[0]?.water).toBe('medium');
      expect(await getDataSyncCursor('profile-A')).toBe('1');
    },
  );

  it('shares overlapping sync calls in the same session', async () => {
    const gate = holdPull();
    const first = syncCompleteHealthData();
    await gate.started;
    const second = syncCompleteHealthData();
    expect(second).toBe(first);
    gate.release();
    await Promise.all([first, second]);
    expect(mocks.pull).toHaveBeenCalledOnce();
  });

  it('orders a local field edit after an already-started remote transaction without losing other fields', async () => {
    remote({
      entityType: 'habit_checkin',
      entityId: date,
      operation: 'upsert',
      payload: { ...habitPayload('low'), fiber: 'medium' },
    });
    const gate = deferred();
    const entered = deferred();
    writeHook = async (sql) => {
      if (sql.includes('INSERT INTO habit_checkins')) {
        writeHook = async () => undefined;
        entered.resolve();
        await gate.promise;
      }
    };
    const syncing = syncCompleteHealthData();
    await entered.promise;
    const editing = useHabitStore.getState().setHabitLevel(date, 'water', 'good');
    gate.resolve();
    await Promise.all([syncing, editing]);
    expect(useHabitStore.getState().checkIns).toMatchObject([{ water: 'good', fiber: 'medium' }]);
    expect(changes.at(-1)?.payload).toMatchObject({ water: 'good', fiber: 'medium' });
  });

  it('does not let another profile pending the same entity block the current profile pull', async () => {
    database.exec(`INSERT INTO local_data_profiles (id, user_id, created_at, updated_at) VALUES ('profile-B', 'B', '${endedAt}', '${endedAt}');
      INSERT INTO data_sync_outbox (mutation_id, profile_id, entity_type, entity_id, operation, payload_json, changed_at)
      VALUES ('B-mutation', 'profile-B', 'habit_checkin', '${date}', 'delete', NULL, '${endedAt}');`);
    remote({ entityType: 'habit_checkin', entityId: date, operation: 'upsert', payload: habitPayload('medium') });
    await syncCompleteHealthData();
    expect(rows('habit_checkins')).toMatchObject([{ profile_id: 'profile-A', water: 'medium' }]);
    expect(rows('data_sync_outbox')).toMatchObject([{ mutation_id: 'B-mutation', profile_id: 'profile-B' }]);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('never uploads an outbox row from a local transaction that later rolls back', async () => {
    const gate = deferred();
    const started = deferred();
    writeHook = async (sql) => {
      if (sql.includes('INSERT INTO daily_activity_summaries')) {
        started.resolve();
        await gate.promise;
        throw new Error('disk full');
      }
    };
    const saving = useHabitStore.getState().setHabitLevel(date, 'water', 'good');
    const failed = expect(saving).rejects.toThrow('disk full');
    await started.promise;
    const syncing = syncCompleteHealthData();
    await Promise.resolve();
    expect(mocks.push).not.toHaveBeenCalled();
    gate.resolve();
    await failed;
    writeHook = async () => undefined;
    await syncing;
    expect(mocks.push).not.toHaveBeenCalled();
    expect(changes).toHaveLength(0);
  });

  it('protects a pending same-label preset from remote alias cleanup', async () => {
    remote({
      entityType: 'toilet_signal_preset',
      entityId: 'remote-preset',
      operation: 'upsert',
      payload: { label: '腹胀', createdAt: endedAt },
    });
    const gate = holdPull();
    const syncing = syncCompleteHealthData();
    await gate.started;
    const local = await createToiletSignalPreset('腹胀');
    mocks.push.mockImplementationOnce(async (request: DataSyncPushRequest) => {
      expect(rows('toilet_signal_presets')).toMatchObject([{ id: local.id, deleted_at: null }]);
      return push(request);
    });
    gate.release();
    await syncing;
    expect(rows('toilet_signal_presets')).toMatchObject([{ id: local.id, sync_version: 2 }]);
    expect(rows('toilet_signal_presets')).toHaveLength(1);
  });

  it('does not lose another device replacement preset when only the old ID is pending deletion', async () => {
    const old = await createToiletSignalPreset('腹胀');
    await syncCompleteHealthData();
    remote({
      entityType: 'toilet_signal_preset',
      entityId: 'replacement',
      operation: 'upsert',
      payload: { label: '腹胀', createdAt: endedAt },
    });
    const gate = holdPull();
    const syncing = syncCompleteHealthData();
    await gate.started;
    await deleteToiletSignalPreset(old.id);
    gate.release();
    await syncing;
    // 删除请求只针对旧 ID，不能把不同 ID 的有效云端记录跳过后永久丢弃。
    expect(rows('toilet_signal_presets')).toMatchObject([{ id: 'replacement', deleted_at: null }]);
    expect(rows('data_sync_outbox')).toHaveLength(0);
  });

  it.each([false, true])(
    'protects a deleted preset and its optional recreation (%s) against stale pull',
    async (recreate) => {
      const preset = await createToiletSignalPreset('腹胀');
      await syncCompleteHealthData();
      remote({
        entityType: 'toilet_signal_preset',
        entityId: preset.id,
        operation: 'upsert',
        payload: { label: '腹胀', createdAt: endedAt },
      });
      const gate = holdPull();
      const syncing = syncCompleteHealthData();
      await gate.started;
      await deleteToiletSignalPreset(preset.id);
      if (recreate) expect((await createToiletSignalPreset('腹胀')).id).toBe(preset.id);
      mocks.push.mockImplementationOnce(async (request: DataSyncPushRequest) => {
        expect(rows('toilet_signal_presets')[0]?.deleted_at === null).toBe(recreate);
        return push(request);
      });
      gate.release();
      await syncing;
      expect(rows('toilet_signal_presets')[0]?.deleted_at === null).toBe(recreate);
      expect(changes.at(-1)?.operation).toBe(recreate ? 'upsert' : 'delete');
    },
  );

  it.each(['edit', 'delete'] as const)(
    'does not publish a failed toilet %s or leave its outbox behind',
    async (action) => {
      await useToiletStore.getState().addSession(toilet);
      await syncCompleteHealthData();
      failOnce('INSERT INTO data_sync_outbox');
      await expect(
        action === 'edit'
          ? useToiletStore.getState().updateSession({ ...toilet, durationSeconds: 300 })
          : useToiletStore.getState().deleteSession(toilet.id),
      ).rejects.toThrow('disk full');
      expect(useToiletStore.getState().sessions).toMatchObject([{ id: toilet.id, durationSeconds: 120 }]);
      expect(rows('toilet_sessions')[0]).toMatchObject({ deleted_at: null, duration_seconds: 120 });
      expect(rows('data_sync_outbox')).toHaveLength(0);
    },
  );
});

function rows(table: string) {
  return database.prepare(`SELECT * FROM ${table}`).all();
}
function habitPayload(water: 'good' | 'medium' | 'low') {
  return { date, water, fiber: null, bowel: null, movement: null };
}
function withoutId<T extends { id: string }>(value: T) {
  const { id: _id, ...payload } = value;
  return payload;
}
function remote(change: Omit<DataSyncChange, 'version' | 'serverUpdatedAt'>) {
  const result = { ...structuredClone(change), version: changes.length + 1, serverUpdatedAt: endedAt };
  changes.push(result);
  return result;
}
function push(request: DataSyncPushRequest) {
  const response = request.mutations.map((mutation: DataSyncMutation) => {
    let change = accepted.get(mutation.mutationId);
    if (!change) {
      change = remote({
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        operation: mutation.operation,
        payload: mutation.payload,
      });
      accepted.set(mutation.mutationId, change);
    }
    return change;
  });
  return { acceptedMutationIds: request.mutations.map((mutation) => mutation.mutationId), changes: response };
}
function pull(cursor: string): DataSyncPullResponse {
  const remaining = changes.filter((change) => change.version > Number(cursor));
  const page = remaining.slice(0, pageSize);
  return {
    changes: structuredClone(page),
    nextCursor: String(page.at(-1)?.version ?? cursor),
    hasMore: remaining.length > pageSize,
    resetRequired: false,
  };
}
function holdPull() {
  const waiting = deferred();
  const started = deferred();
  mocks.pull.mockImplementationOnce(async (cursor: string) => {
    const response = pull(cursor);
    started.resolve();
    await waiting.promise;
    return response;
  });
  return { started: started.promise, release: waiting.resolve };
}
function failOnce(pattern: string) {
  writeHook = async (sql) => {
    if (sql.includes(pattern)) {
      writeHook = async () => undefined;
      throw new Error('disk full');
    }
  };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

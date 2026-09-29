import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authSessionContext } from '../../../api/sessionContext';
import { runMigrations } from '../../../storage/migrations';
import { useHabitStore } from '../../habits/habitStore';
import { subscribeToLocalDataChanges } from '../../sync/localDataEvents';
import { useToiletStore } from '../../toilet/toiletStore';
import { useToiletTimerSessionStore } from '../../toilet/toiletTimerSessionStore';
import { finishToiletTimer } from '../../toilet/toiletDraftService';
import { useTrainingStore } from '../../training/trainingStore';
import { handleWatchEvent } from '../watchEventHandler';
import type { WatchEvent } from '../watchTypes';

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  user: vi.fn(),
  entitlements: vi.fn(),
  access: vi.fn(),
  loading: false,
  hydrated: true,
  storage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock('../../../storage/db', () => ({ initializeDatabase: mocks.db }));
vi.mock('expo-sqlite/kv-store', () => ({ default: mocks.storage }));
vi.mock('../../account/accountQueryService', () => ({
  getCachedCurrentUser: mocks.user,
  getCachedEntitlements: mocks.entitlements,
  getCachedFeatureAccess: mocks.access,
}));
vi.mock('../../account/authStore', () => ({
  useAuthStore: { getState: () => ({ isLoading: mocks.loading, hasHydrated: mocks.hydrated }) },
}));
vi.mock('../../settings/appSettingsStore', () => ({
  useAppSettingsStore: { getState: () => ({ toiletStageNotificationEnabled: false }) },
}));
vi.mock('../../growth/growthEventTracker', () => ({ trackGrowthEvent: vi.fn() }));
vi.mock('../../toilet/toiletLiveActivity', () => ({
  endToiletLiveActivity: vi.fn(),
  pauseToiletLiveActivity: vi.fn(),
  resumeToiletLiveActivity: vi.fn(),
}));
vi.mock('../../toilet/toiletStageNotificationService', () => ({
  cancelToiletStageNotifications: vi.fn(),
  syncToiletStageNotifications: vi.fn(),
}));

let database: DatabaseSync;
let writeHook: (sql: string) => Promise<void>;
const owner = { userId: 'A', profileId: 'profile-A' };
const date = '2026-09-28';
const now = `${date}T12:00:00.000Z`;
const training = {
  id: 'phone-training',
  presetId: 'standard' as const,
  startedAt: `${date}T11:58:00.000Z`,
  endedAt: now,
  durationSeconds: 120,
  completedRepetitions: 12,
  isCompleted: true,
  feedback: 'unanswered' as const,
  endReason: 'completed' as const,
  plan: { contractSeconds: 5, relaxSeconds: 5, repetitions: 12 },
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse(now));
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
  database.exec(`INSERT INTO local_data_profiles (id, user_id, created_at, updated_at) VALUES ('profile-A', 'A', '${now}', '${now}');
    UPDATE app_metadata SET value = 'profile-A' WHERE key = 'active_profile_id';`);
  authSessionContext.activate({ ...owner, generation: authSessionContext.beginTransition(), accessToken: 'token-A' });
  mocks.user.mockReturnValue({ id: 'A' });
  mocks.entitlements.mockReturnValue({});
  mocks.access.mockReturnValue(true);
  mocks.loading = false;
  mocks.hydrated = true;
  mocks.storage.setItem.mockResolvedValue(undefined);
  useTrainingStore.getState().reset();
  useHabitStore.getState().reset();
  useToiletStore.getState().reset();
  useToiletTimerSessionStore.setState({ session: null });
});
afterEach(() => {
  database.close();
  vi.restoreAllMocks();
});

describe('save -> SQLite -> visible state -> Watch ACK', () => {
  it('retries a saved phone training after restart without duplicating summary or outbox', async () => {
    await useTrainingStore.getState().addSession(training);
    useTrainingStore.getState().reset();
    await useTrainingStore.getState().addSession(training);
    expect(rows('training_sessions')).toHaveLength(1);
    expect(rows('data_sync_outbox')).toHaveLength(1);
    expect(rows('daily_activity_summaries')).toMatchObject([{ training_completed_count: 1 }]);
  });

  it('rejects a reused training ID with different content instead of reporting it saved', async () => {
    await useTrainingStore.getState().addSession(training);
    await expect(useTrainingStore.getState().addSession({ ...training, durationSeconds: 60 })).rejects.toThrow(
      '内容不同',
    );
    expect(rows('training_sessions')).toMatchObject([{ duration_seconds: 120 }]);
    expect(rows('data_sync_outbox')).toHaveLength(1);
  });

  it('rejects a timer owned by another account even when its ID is known', async () => {
    startTimer('timer-A');
    const timer = useToiletTimerSessionStore.getState().session!;
    useToiletTimerSessionStore.setState({ session: { ...timer, owner: { userId: 'B', profileId: 'profile-B' } } });
    expect(await handleWatchEvent(finishEvent())).toMatchObject({ status: 'rejected' });
    expect(rows('toilet_sessions')).toHaveLength(0);
    expect(useToiletTimerSessionStore.getState().session?.id).toBe('timer-A');
  });
  it.each(['training_sessions', 'data_sync_outbox', 'daily_activity_summaries', 'watch_event_receipts'])(
    'rolls back all effects and returns retryable when %s fails',
    async (table) => {
      writeHook = async (sql) => {
        if (sql.includes(`INSERT INTO ${table}`)) throw new Error('disk full');
      };
      const event = trainingEvent();
      expect(await handleWatchEvent(event)).toMatchObject({ eventId: event.id, status: 'retryable' });
      for (const name of ['training_sessions', 'data_sync_outbox', 'daily_activity_summaries', 'watch_event_receipts'])
        expect(rows(name)).toHaveLength(0);
      expect(useTrainingStore.getState().sessions).toHaveLength(0);
      writeHook = async () => undefined;
      expect(await handleWatchEvent(event)).toMatchObject({ status: 'accepted' });
      expect(useTrainingStore.getState().sessions).toHaveLength(1);
    },
  );

  it('does not display success until the transaction is committed', async () => {
    const gate = deferred();
    let entered = false;
    writeHook = async (sql) => {
      if (sql.includes('INSERT INTO data_sync_outbox')) {
        entered = true;
        await gate.promise;
      }
    };
    const saving = useTrainingStore.getState().addSession(training);
    await vi.waitFor(() => expect(entered).toBe(true));
    expect(useTrainingStore.getState().sessions).toHaveLength(0);
    gate.resolve();
    await saving;
    expect(useTrainingStore.getState().sessions.map((session) => session.id)).toEqual([training.id]);
    expect(rows('daily_activity_summaries')).toMatchObject([{ training_completed_count: 1 }]);
  });

  it.each(['training', 'habit', 'toilet'] as const)(
    'propagates %s save failure without changing visible data',
    async (kind) => {
      writeHook = async (sql) => {
        if (sql.includes('INSERT INTO daily_activity_summaries')) throw new Error('disk full');
      };
      const save =
        kind === 'training'
          ? useTrainingStore.getState().addSession(training)
          : kind === 'habit'
            ? useHabitStore.getState().setHabitLevel(date, 'water', 'good')
            : useToiletStore.getState().addSession({
                id: 'toilet',
                startedAt: training.startedAt,
                endedAt: now,
                durationSeconds: 120,
                bleeding: false,
                discomfort: false,
                feeling: 'normal',
              });
      await expect(save).rejects.toThrow('disk full');
      expect(useTrainingStore.getState().sessions).toHaveLength(0);
      expect(useHabitStore.getState().checkIns).toHaveLength(0);
      expect(useToiletStore.getState().sessions).toHaveLength(0);
      expect(rows('data_sync_outbox')).toHaveLength(0);
    },
  );

  it('deduplicates concurrent sends and replay after memory reset using persisted receipts', async () => {
    const event = trainingEvent();
    const results = await Promise.all([handleWatchEvent(event), handleWatchEvent(event)]);
    expect(results.map((ack) => ack.status).sort()).toEqual(['accepted', 'duplicate']);
    useTrainingStore.getState().reset();
    expect(await handleWatchEvent(event)).toMatchObject({ status: 'duplicate' });
    expect(rows('training_sessions')).toHaveLength(1);
    expect(rows('data_sync_outbox')).toHaveLength(1);
    expect(rows('watch_event_receipts')).toHaveLength(1);
    expect(rows('daily_activity_summaries')).toMatchObject([{ training_completed_count: 1 }]);
  });

  it('does not revert a newer habit edit when an old ACK was lost', async () => {
    const event: WatchEvent = {
      ...trainingEvent(),
      id: 'habit',
      type: 'habit_toggled',
      payload: { habitKey: 'water', level: 'good' },
    };
    expect(await handleWatchEvent(event)).toMatchObject({ status: 'accepted' });
    await useHabitStore.getState().setHabitLevel(date, 'water', 'low');
    expect(await handleWatchEvent(event)).toMatchObject({ status: 'duplicate' });
    expect(rows('habit_checkins')).toMatchObject([{ water: 'low' }]);
    expect(rows('data_sync_outbox')).toHaveLength(2);
  });

  it('preserves both fields when habit saves overlap', async () => {
    await Promise.all([
      useHabitStore.getState().setHabitLevel(date, 'water', 'good'),
      useHabitStore.getState().setHabitLevel(date, 'fiber', 'medium'),
    ]);
    expect(rows('habit_checkins')).toMatchObject([{ water: 'good', fiber: 'medium' }]);
    expect(useHabitStore.getState().checkIns).toMatchObject([{ water: 'good', fiber: 'medium' }]);
  });

  it('rejects a reused ID with different content and an event belonging to another account', async () => {
    const event = trainingEvent();
    await handleWatchEvent(event);
    expect(
      await handleWatchEvent({ ...event, payload: { session: { ...event.payload.session, durationSeconds: 121 } } }),
    ).toMatchObject({
      status: 'rejected',
    });
    expect(
      await handleWatchEvent({ ...event, id: 'other', owner: { userId: 'B', profileId: 'profile-B' } }),
    ).toMatchObject({ status: 'rejected' });
    expect(rows('training_sessions')).toHaveLength(1);
  });

  it('distinguishes temporarily unavailable authorization from permanent refusal', async () => {
    mocks.entitlements.mockReturnValue(null);
    expect(await handleWatchEvent(trainingEvent())).toMatchObject({ status: 'retryable' });
    mocks.entitlements.mockReturnValue({});
    mocks.access.mockReturnValue(false);
    expect(await handleWatchEvent(trainingEvent())).toMatchObject({ status: 'retryable' });
    authSessionContext.beginTransition();
    mocks.loading = true;
    expect(await handleWatchEvent(trainingEvent())).toMatchObject({ status: 'retryable' });
    mocks.loading = false;
    mocks.hydrated = false;
    expect(await handleWatchEvent(trainingEvent())).toMatchObject({ status: 'retryable' });
    mocks.hydrated = true;
    expect(await handleWatchEvent(trainingEvent())).toMatchObject({ status: 'rejected' });
    expect(rows('data_sync_outbox')).toHaveLength(0);
  });

  it('rolls back when an account transition starts during the write', async () => {
    writeHook = async (sql) => {
      if (sql.includes('INSERT INTO watch_event_receipts')) authSessionContext.beginTransition();
    };
    expect(await handleWatchEvent(trainingEvent())).toMatchObject({ status: 'rejected' });
    expect(rows('training_sessions')).toHaveLength(0);
    expect(rows('watch_event_receipts')).toHaveLength(0);
    expect(useTrainingStore.getState().sessions).toHaveLength(0);
  });

  it('does not report a successful commit as failed when a change observer throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const unsubscribe = subscribeToLocalDataChanges(() => {
      throw new Error('observer failure');
    });
    try {
      expect(await handleWatchEvent(trainingEvent())).toMatchObject({ status: 'accepted' });
    } finally {
      unsubscribe();
    }
    expect(rows('training_sessions')).toHaveLength(1);
  });

  it('retries timer cleanup after a committed finish without duplicating the record or clearing a new timer', async () => {
    startTimer('timer-A');
    mocks.storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));
    const event = finishEvent();
    expect(await handleWatchEvent(event)).toMatchObject({ status: 'retryable' });
    expect(rows('toilet_sessions')).toHaveLength(1);
    expect(useToiletTimerSessionStore.getState().session?.id).toBe('timer-A');
    expect(await handleWatchEvent(event)).toMatchObject({ status: 'duplicate' });
    expect(useToiletTimerSessionStore.getState().session).toBeNull();
    startTimer('timer-B');
    expect(await handleWatchEvent(event)).toMatchObject({ status: 'duplicate' });
    expect(useToiletTimerSessionStore.getState().session?.id).toBe('timer-B');
    expect(rows('toilet_sessions')).toHaveLength(1);
    expect(rows('data_sync_outbox')).toHaveLength(1);
  });

  it('rejects old timer actions, including a timer replaced during the save', async () => {
    startTimer('timer-B');
    expect(await handleWatchEvent(finishEvent())).toMatchObject({ status: 'rejected' });
    startTimer('timer-A');
    writeHook = async (sql) => {
      if (sql.includes('INSERT INTO daily_activity_summaries')) startTimer('timer-B');
    };
    expect(await handleWatchEvent(finishEvent())).toMatchObject({ status: 'rejected' });
    expect(rows('toilet_sessions')).toHaveLength(0);
    expect(rows('data_sync_outbox')).toHaveLength(0);
    expect(useToiletTimerSessionStore.getState().session?.id).toBe('timer-B');
  });

  it('retries pause after a receipt failure and does not replay it over a later resume', async () => {
    startTimer('timer-A');
    const event: WatchEvent = {
      ...finishEvent(),
      payload: { sessionId: 'timer-A', action: 'pause', elapsedSeconds: 120 },
    };
    writeHook = async (sql) => {
      if (sql.includes('INSERT INTO watch_event_receipts')) throw new Error('disk full');
    };
    expect(await handleWatchEvent(event)).toMatchObject({ status: 'retryable' });
    expect(rows('watch_event_receipts')).toHaveLength(0);
    writeHook = async () => undefined;
    expect(await handleWatchEvent(event)).toMatchObject({ status: 'accepted' });
    useToiletTimerSessionStore.getState().resumeSession();
    expect(await handleWatchEvent(event)).toMatchObject({ status: 'duplicate' });
    expect(useToiletTimerSessionStore.getState().session?.isPaused).toBe(false);
  });

  it('rejects a late Watch finish after a phone draft was committed, including stale restored KV state', async () => {
    startTimer('timer-A');
    const previous = useToiletTimerSessionStore.getState().session;
    await finishToiletTimer('timer-A', new Date(now));
    useToiletTimerSessionStore.setState({ session: previous });
    expect(await handleWatchEvent(finishEvent())).toMatchObject({ status: 'rejected' });
    expect(rows('toilet_sessions')).toHaveLength(0);
    expect(rows('toilet_record_drafts')).toHaveLength(1);
  });

  it('does not create a phone draft after Watch committed but timer cleanup failed', async () => {
    startTimer('timer-A');
    mocks.storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));
    expect(await handleWatchEvent(finishEvent())).toMatchObject({ status: 'retryable' });
    expect(useToiletTimerSessionStore.getState().session?.id).toBe('timer-A');
    expect(await finishToiletTimer('timer-A', new Date(now))).toBeNull();
    expect(useToiletTimerSessionStore.getState().session).toBeNull();
    expect(rows('toilet_sessions')).toHaveLength(1);
    expect(rows('toilet_record_drafts')).toMatchObject([{ id: 'timer-A', state: 'saved', record_json: null }]);
    expect(rows('data_sync_outbox')).toHaveLength(1);
    expect(await handleWatchEvent(finishEvent())).toMatchObject({ status: 'duplicate' });
  });

  it('rolls back the Watch completion marker with the record and receipt when saving fails', async () => {
    startTimer('timer-A');
    writeHook = async (sql) => {
      if (sql.includes('INSERT INTO watch_event_receipts')) throw new Error('disk full');
    };
    expect(await handleWatchEvent(finishEvent())).toMatchObject({ status: 'retryable' });
    for (const table of ['toilet_record_drafts', 'toilet_sessions', 'data_sync_outbox', 'watch_event_receipts'])
      expect(rows(table)).toHaveLength(0);
    expect(useToiletTimerSessionStore.getState().session?.id).toBe('timer-A');
    writeHook = async () => undefined;
    expect(await finishToiletTimer('timer-A', new Date(now))).toBe('timer-A');
    expect(rows('toilet_record_drafts')).toMatchObject([{ state: 'pending' }]);
  });

  it('blocks anonymous writes during a profile transition and allows them after it completes', async () => {
    const generation = authSessionContext.beginTransition();
    await expect(useTrainingStore.getState().addSession(training)).rejects.toMatchObject({ code: 'session_changed' });
    database.exec("UPDATE app_metadata SET value = 'local-default' WHERE key = 'active_profile_id'");
    authSessionContext.completeAnonymousTransition(generation);
    await useTrainingStore.getState().addSession(training);
    expect(rows('training_sessions')).toMatchObject([{ profile_id: 'local-default' }]);
  });
});

function rows(table: string) {
  return database.prepare(`SELECT * FROM ${table}`).all();
}
function trainingEvent(): Extract<WatchEvent, { type: 'training_finished' }> {
  return {
    id: 'watch-event-1',
    schemaVersion: 4,
    type: 'training_finished',
    createdAt: now,
    owner,
    payload: { session: { ...training, id: 'watch-event-1' } },
  };
}
function finishEvent(): Extract<WatchEvent, { type: 'toilet_timer_action' }> {
  return {
    id: 'finish-1',
    schemaVersion: 4,
    type: 'toilet_timer_action',
    createdAt: now,
    owner,
    payload: { sessionId: 'timer-A', action: 'finish', elapsedSeconds: 120 },
  };
}
function startTimer(id: string) {
  useToiletTimerSessionStore.setState({
    session: {
      owner,
      id,
      startedAt: training.startedAt,
      baseElapsedSeconds: 120,
      isPaused: true,
      lastResumedAt: null,
      liveActivityId: null,
    },
  });
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

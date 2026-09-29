import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authSessionContext } from '../../../api/sessionContext';
import { runMigrations } from '../../../storage/migrations';
import { mergeAnonymousProfile } from '../../../storage/profileDataMerge';
import { getDailyDataDetails, purgeExpiredLocalHealthData } from '../../data/dailyData';
import { getLocalDateKey } from '../../habits/habitLogic';
import {
  deleteToiletSession,
  getToiletSession,
  updateToiletSession,
} from '../../../storage/repositories/toiletRepository';
import { createToiletRecordDraft } from '../toiletRecordLogic';
import { useToiletTimerSessionStore } from '../toiletTimerSessionStore';
import {
  discardPendingToiletRecord,
  finishToiletTimer,
  getPendingToiletRecord,
  isToiletTimerCompleted,
  listPendingToiletRecords,
  recoverCompletedToiletTimer,
  savePendingToiletRecord,
  updatePendingToiletRecord,
} from '../toiletDraftService';

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  storage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock('../../../storage/db', () => ({ initializeDatabase: mocks.db }));
vi.mock('expo-sqlite/kv-store', () => ({ default: mocks.storage }));

let database: DatabaseSync;
let adapter: SQLiteDatabase;
let failWrite: RegExp | null;
let onWrite: ((sql: string) => void) | null;
const endedAt = new Date(2026, 8, 28, 23, 59, 30);
const timer = {
  id: 'timer-draft',
  owner: null,
  startedAt: new Date(2026, 8, 28, 23, 54, 0).toISOString(),
  baseElapsedSeconds: 90,
  isPaused: false,
  lastResumedAt: new Date(2026, 8, 28, 23, 57, 0).toISOString(),
  liveActivityId: null,
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 29, 0, 10));
  failWrite = null;
  onWrite = null;
  mocks.storage.setItem.mockResolvedValue(undefined);
  database = new DatabaseSync(':memory:');
  adapter = {
    execAsync: async (sql: string) => database.exec(sql),
    runAsync: async (sql: string, params: Record<string, SQLInputValue> = {}) => {
      onWrite?.(sql);
      if (failWrite?.test(sql)) {
        failWrite = null;
        throw new Error('disk full');
      }
      return database.prepare(sql).run(params);
    },
    getFirstAsync: async (sql: string, params: Record<string, SQLInputValue> = {}) =>
      database.prepare(sql).get(params) ?? null,
    getAllAsync: async (sql: string, params: Record<string, SQLInputValue> = {}) => database.prepare(sql).all(params),
    withTransactionAsync: async (work: () => Promise<void>) => {
      database.exec('BEGIN');
      try {
        await work();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;
  mocks.db.mockResolvedValue(adapter);
  await runMigrations(adapter);
  authSessionContext.completeAnonymousTransition(authSessionContext.beginTransition());
  useToiletTimerSessionStore.setState({ session: { ...timer } });
});
afterEach(() => {
  database.close();
  vi.useRealTimers();
});

async function finish() {
  await finishToiletTimer(timer.id, endedAt);
  const entry = await getPendingToiletRecord(timer.id);
  if (!entry) throw new Error('missing draft');
  return entry;
}
function count(table: string) {
  return Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count);
}
function switchToB() {
  database.exec(`INSERT OR IGNORE INTO local_data_profiles (id, user_id, created_at, updated_at)
    VALUES ('profile-B', 'B', 'now', 'now');
    UPDATE app_metadata SET value = 'profile-B' WHERE key = 'active_profile_id';`);
  authSessionContext.activate({
    generation: authSessionContext.beginTransition(),
    profileId: 'profile-B',
    userId: 'B',
    accessToken: 'token-B',
  });
}

describe('toilet drafts and record correction', () => {
  it('durably ends a timer once, preserving actual end time and excluding pauses', async () => {
    const first = finishToiletTimer(timer.id, endedAt);
    const second = finishToiletTimer(timer.id, new Date(2026, 8, 29, 0, 9));
    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(useToiletTimerSessionStore.getState().session).toBeNull();
    const entries = await listPendingToiletRecords();
    expect(entries).toHaveLength(1);
    expect(entries[0].record).toMatchObject({
      startedAt: timer.startedAt,
      endedAt: endedAt.toISOString(),
      durationSeconds: 240,
    });
    expect(count('toilet_sessions')).toBe(0);
    expect(count('data_sync_outbox')).toBe(0);
    expect(count('daily_activity_summaries')).toBe(0);
  });

  it('preserves paused time without adding the wait before finishing', async () => {
    useToiletTimerSessionStore.setState({ session: { ...timer, isPaused: true, lastResumedAt: null } });
    expect((await finish()).record.durationSeconds).toBe(90);
  });

  it('keeps the active timer if creating the draft fails', async () => {
    failWrite = /INSERT INTO toilet_record_drafts/;
    await expect(finishToiletTimer(timer.id, endedAt)).rejects.toThrow('disk full');
    expect(useToiletTimerSessionStore.getState().session?.id).toBe(timer.id);
    expect(count('toilet_record_drafts')).toBe(0);
    expect((await finish()).record.id).toBe(timer.id);
  });

  it('recovers the crash window after draft commit but before clearing persisted timer state', async () => {
    mocks.storage.setItem.mockRejectedValueOnce(new Error('KV failure'));
    const entry = await finish();
    expect(entry.record.endedAt).toBe(endedAt.toISOString());
    useToiletTimerSessionStore.setState({ session: { ...timer } }); // reload the old KV state
    expect(await isToiletTimerCompleted(timer.id)).toBe(true);
    await recoverCompletedToiletTimer();
    expect(useToiletTimerSessionStore.getState().session).toBeNull();
    expect((await getPendingToiletRecord(timer.id))?.record).toEqual(entry.record);
  });

  it('reloads filled fields and saves once even when saved after midnight or retried', async () => {
    const entry = await finish();
    const values = {
      ...createToiletRecordDraft(entry.record),
      feeling: 'difficult' as const,
      durationSeconds: 180,
      bleeding: true,
      signals: [{ id: 'signal', label: '腹胀' }],
    };
    await updatePendingToiletRecord(entry, values);
    const restored = await getPendingToiletRecord(timer.id);
    expect(restored?.record).toMatchObject(values);
    await savePendingToiletRecord(restored!, values);
    await savePendingToiletRecord(restored!, values);
    await updatePendingToiletRecord(restored!, { ...values, durationSeconds: 600 });
    expect(await getPendingToiletRecord(timer.id)).toBeNull();
    expect(count('toilet_sessions')).toBe(1);
    expect(count('data_sync_outbox')).toBe(1);
    expect(await getToiletSession(timer.id)).toMatchObject({
      ...values,
      endedAt: endedAt.toISOString(),
      startedAt: timer.startedAt,
    });
    const details = await getDailyDataDetails(getLocalDateKey(endedAt));
    expect(details.summary.toilet.sessionCount).toBe(1);
    expect(details.summary.toilet.totalDurationSeconds).toBe(180);
    expect((await getDailyDataDetails('2026-09-29')).summary.toilet.sessionCount).toBe(0);
  });

  it.each([
    /INSERT INTO toilet_sessions/,
    /INSERT INTO data_sync_outbox/,
    /INSERT INTO daily_activity_summaries/,
    /SET state =/,
  ])('rolls back record, outbox, summary and draft completion on failure %s', async (pattern) => {
    const entry = await finish();
    const values = createToiletRecordDraft(entry.record);
    failWrite = pattern;
    await expect(savePendingToiletRecord(entry, values)).rejects.toThrow('disk full');
    expect(count('toilet_sessions')).toBe(0);
    expect(count('data_sync_outbox')).toBe(0);
    expect(count('daily_activity_summaries')).toBe(0);
    expect(await getPendingToiletRecord(timer.id)).not.toBeNull();
    await savePendingToiletRecord(entry, values);
    expect(count('toilet_sessions')).toBe(1);
  });

  it('discards only the selected draft and cannot resurrect it with a late autosave', async () => {
    const entry = await finish();
    const values = createToiletRecordDraft(entry.record);
    await discardPendingToiletRecord(entry);
    await updatePendingToiletRecord(entry, values);
    await expect(savePendingToiletRecord(entry, values)).rejects.toThrow('已放弃');
    expect(await listPendingToiletRecords()).toEqual([]);
    expect(count('data_sync_outbox')).toBe(0);
    useToiletTimerSessionStore.setState({ session: { ...timer } });
    await recoverCompletedToiletTimer();
    expect(useToiletTimerSessionStore.getState().session).toBeNull();
  });

  it('does not expose or save a previous profile draft after an account change', async () => {
    const entry = await finish();
    switchToB();
    expect(await listPendingToiletRecords()).toEqual([]);
    expect(await getPendingToiletRecord(timer.id)).toBeNull();
    for (const work of [
      () => savePendingToiletRecord(entry, createToiletRecordDraft(entry.record)),
      () => updatePendingToiletRecord(entry, createToiletRecordDraft(entry.record)),
      () => discardPendingToiletRecord(entry),
    ])
      await expect(work()).rejects.toMatchObject({ code: 'session_changed' });
    expect(count('toilet_sessions')).toBe(0);
    expect(count('toilet_record_drafts')).toBe(1);
  });

  it('merges anonymous drafts into an existing account without uploading them', async () => {
    await finish();
    switchToB();
    await mergeAnonymousProfile(adapter, 'local-default', 'profile-B');
    const entries = await listPendingToiletRecords();
    expect(entries).toHaveLength(1);
    expect(entries[0].profileId).toBe('profile-B');
    expect(count('data_sync_outbox')).toBe(0);
    await savePendingToiletRecord(entries[0], createToiletRecordDraft(entries[0].record));
    expect(database.prepare('SELECT profile_id FROM toilet_sessions').get()?.profile_id).toBe('profile-B');
  });

  it('rejects finishing a timer after its owner changes', async () => {
    switchToB();
    await expect(finishToiletTimer(timer.id, endedAt)).rejects.toMatchObject({ code: 'session_changed' });
    expect(count('toilet_record_drafts')).toBe(0);
    expect(useToiletTimerSessionStore.getState().session?.id).toBe(timer.id);
  });

  it('updates and deletes the saved record through the existing repository with summary and outbox changes', async () => {
    const entry = await finish();
    await savePendingToiletRecord(entry, createToiletRecordDraft(entry.record));
    const saved = (await getToiletSession(timer.id))!;
    await updateToiletSession({ ...saved, durationSeconds: 300, discomfort: true });
    let details = await getDailyDataDetails(getLocalDateKey(endedAt));
    expect(details.toiletSessions[0]).toMatchObject({ durationSeconds: 300, discomfort: true });
    expect(details.summary.toilet.totalDurationSeconds).toBe(300);
    await deleteToiletSession(timer.id);
    details = await getDailyDataDetails(getLocalDateKey(endedAt));
    expect(details.toiletSessions).toEqual([]);
    expect(details.summary.toilet.sessionCount).toBe(0);
    expect(
      database.prepare('SELECT operation FROM data_sync_outbox ORDER BY sequence DESC LIMIT 1').get()?.operation,
    ).toBe('delete');
    await savePendingToiletRecord(entry, createToiletRecordDraft(entry.record));
    expect(await getToiletSession(timer.id)).toBeNull();
  });

  it('cleans expired drafts and prevents an expired persisted timer from returning', async () => {
    const entry = await finish();
    vi.setSystemTime(new Date(2027, 0, 1));
    expect(await listPendingToiletRecords()).toEqual([]);
    expect(await getPendingToiletRecord(timer.id)).toBeNull();
    await expect(savePendingToiletRecord(entry, createToiletRecordDraft(entry.record))).rejects.toThrow('保留期');
    await purgeExpiredLocalHealthData(new Date());
    expect(count('toilet_record_drafts')).toBe(0);
    useToiletTimerSessionStore.setState({ session: { ...timer } });
    await recoverCompletedToiletTimer();
    expect(useToiletTimerSessionStore.getState().session).toBeNull();
  });

  it('rolls back a draft when the account changes while its creation is in flight', async () => {
    onWrite = (sql) => {
      if (sql.includes('INSERT INTO toilet_record_drafts')) authSessionContext.beginTransition();
    };
    await expect(finishToiletTimer(timer.id, endedAt)).rejects.toMatchObject({ code: 'session_changed' });
    expect(count('toilet_record_drafts')).toBe(0);
    expect(useToiletTimerSessionStore.getState().session?.id).toBe(timer.id);
  });

  it('rolls back final saving when its loaded account changes during the transaction', async () => {
    const entry = await finish();
    onWrite = (sql) => {
      if (sql.includes('INSERT INTO toilet_sessions')) authSessionContext.beginTransition();
    };
    await expect(savePendingToiletRecord(entry, createToiletRecordDraft(entry.record))).rejects.toMatchObject({
      code: 'session_changed',
    });
    expect(count('toilet_sessions')).toBe(0);
    expect(count('data_sync_outbox')).toBe(0);
    expect(database.prepare('SELECT state FROM toilet_record_drafts').get()?.state).toBe('pending');
  });
});

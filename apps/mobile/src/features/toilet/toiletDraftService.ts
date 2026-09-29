import type { SQLiteDatabase } from 'expo-sqlite';

import { authSessionContext, SessionChangedError } from '../../api/sessionContext';
import { initializeDatabase } from '../../storage/db';
import { buildLocalDateRange } from '../../storage/dateRange';
import { getActiveLocalProfileId } from '../../storage/localDataProfile';
import { commitLocalMutation } from '../../storage/localMutation';
import { insertToiletSessionRow } from '../../storage/repositories/toiletRepository';
import { notifyLocalDataChanged } from '../sync/localDataEvents';
import { createToiletRecordDraft } from './toiletRecordLogic';
import { getActiveToiletTimerElapsedSeconds, useToiletTimerSessionStore } from './toiletTimerSessionStore';
import type { ToiletRecordDraft, ToiletSession } from './toiletTypes';

export type PendingToiletRecord = {
  generation: number;
  profileId: string;
  record: ToiletSession;
};
type DraftRow = {
  profile_id: string;
  ended_at: string;
  state: 'pending' | 'saved' | 'discarded';
  record_json: string | null;
};
const finishingTimers = new Map<string, Promise<string | null>>();

/** 草稿提交先于计时清理；两者之间崩溃时，完成标记阻止旧计时再次保存。 */
export function finishToiletTimer(sessionId: string, endedAt = new Date()): Promise<string | null> {
  const pending = finishingTimers.get(sessionId);
  if (pending) return pending;
  const next = persistFinishedTimer(sessionId, endedAt).finally(() => finishingTimers.delete(sessionId));
  finishingTimers.set(sessionId, next);
  return next;
}

async function persistFinishedTimer(sessionId: string, endedAt: Date): Promise<string | null> {
  const generation = authSessionContext.captureLocalGeneration();
  return authSessionContext.runExclusive(generation, async () => {
    const db = await initializeDatabase();
    const profileId = await getActiveLocalProfileId();
    const timer = useToiletTimerSessionStore.getState().session;
    if (!timer || timer.id !== sessionId) throw new Error('这次计时已变更，请重新打开。');
    if (timer.startedAt < buildLocalDateRange(90).fromDateTime)
      throw new Error('这次计时已超出 90 天保留期，请放弃后重新开始。');
    const owner = authSessionContext.current();
    if (owner && owner.profileId !== profileId) throw new SessionChangedError();
    if (timer.owner?.userId !== owner?.userId || timer.owner?.profileId !== owner?.profileId)
      throw new SessionChangedError();
    authSessionContext.assertGeneration(generation);
    const existing = await findDraft(db, sessionId);
    if (existing && existing.profile_id !== profileId) throw new SessionChangedError();
    if (!existing) {
      if (!Number.isFinite(endedAt.getTime()) || endedAt.getTime() < Date.parse(timer.startedAt))
        throw new Error('结束时间无效，请检查设备时间。');
      const record: ToiletSession = {
        id: timer.id,
        startedAt: timer.startedAt,
        endedAt: endedAt.toISOString(),
        durationSeconds: getActiveToiletTimerElapsedSeconds(timer, endedAt),
        feeling: 'normal',
        bleeding: false,
        discomfort: false,
        signals: [],
        stoolColor: null,
        stoolShape: null,
      };
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO toilet_record_drafts (id, profile_id, started_at, ended_at, state, record_json, updated_at)
           VALUES ($id, $profileId, $startedAt, $endedAt, 'pending', $record, $endedAt);`,
          {
            $id: timer.id,
            $profileId: profileId,
            $startedAt: record.startedAt,
            $endedAt: record.endedAt,
            $record: JSON.stringify(record),
          },
        );
        authSessionContext.assertGeneration(generation);
        if (useToiletTimerSessionStore.getState().session?.id !== timer.id) throw new Error('计时已变更。');
      });
    }
    // 即使 KV 写失败，SQLite 中的草稿/完成标记也已落盘；内存不能恢复成运行中。
    await clearCompletedTimer(sessionId);
    notifyLocalDataChanged();
    return existing && existing.state !== 'pending' ? null : sessionId;
  });
}

export async function isToiletTimerCompleted(sessionId: string) {
  await finishingTimers.get(sessionId)?.catch(() => undefined);
  const generation = authSessionContext.captureLocalGeneration();
  return authSessionContext.runExclusive(generation, async () => {
    const row = await findDraft(await initializeDatabase(), sessionId);
    authSessionContext.assertGeneration(generation);
    return Boolean(row);
  });
}

/** 启动时处理“草稿已提交、旧 KV 计时尚未清掉”的崩溃窗口，不修改其他计时。 */
export async function recoverCompletedToiletTimer() {
  const timer = useToiletTimerSessionStore.getState().session;
  if (timer && (timer.startedAt < buildLocalDateRange(90).fromDateTime || (await isToiletTimerCompleted(timer.id))))
    await clearCompletedTimer(timer.id);
}

async function clearCompletedTimer(sessionId: string) {
  if (useToiletTimerSessionStore.getState().session?.id !== sessionId) return;
  try {
    await useToiletTimerSessionStore.setState({ session: null });
  } catch {
    // 下次恢复从 SQLite 完成标记再清理；不撤销已保存的草稿。
  }
}

export async function listPendingToiletRecords(): Promise<PendingToiletRecord[]> {
  return readCurrentProfile(async (db, profileId, generation) => {
    const rows = await db.getAllAsync<DraftRow>(
      "SELECT profile_id, ended_at, state, record_json FROM toilet_record_drafts WHERE profile_id = $profileId AND state = 'pending' AND ended_at >= $cutoff ORDER BY ended_at DESC;",
      { $profileId: profileId, $cutoff: buildLocalDateRange(90).fromDateTime },
    );
    return rows.map((row) => toPendingRecord(row, generation));
  });
}

export async function getPendingToiletRecord(id: string): Promise<PendingToiletRecord | null> {
  return readCurrentProfile(async (db, profileId, generation) => {
    const row = await findDraft(db, id);
    return row?.profile_id === profileId &&
      row.state === 'pending' &&
      row.ended_at >= buildLocalDateRange(90).fromDateTime
      ? toPendingRecord(row, generation)
      : null;
  });
}

export async function updatePendingToiletRecord(entry: PendingToiletRecord, values: ToiletRecordDraft) {
  await commitLocalMutation(entry, async (db, profileId) => {
    const record = {
      ...entry.record,
      ...values,
      id: entry.record.id,
      startedAt: entry.record.startedAt,
      endedAt: entry.record.endedAt,
    };
    // UPDATE 而非 upsert：迟到的自动保存不能复活已保存或放弃的草稿。
    await db.runAsync(
      "UPDATE toilet_record_drafts SET record_json = $record, updated_at = $now WHERE id = $id AND profile_id = $profileId AND state = 'pending';",
      { $id: record.id, $profileId: profileId, $record: JSON.stringify(record), $now: new Date().toISOString() },
    );
  });
}

export async function savePendingToiletRecord(entry: PendingToiletRecord, values: ToiletRecordDraft) {
  if (!Number.isInteger(values.durationSeconds) || values.durationSeconds <= 0)
    throw new Error('时长请至少设为 1 秒。');
  await commitLocalMutation(entry, async (db, profileId) => {
    const row = await findDraft(db, entry.record.id);
    if (!row || row.profile_id !== profileId) throw new SessionChangedError();
    if (row.state === 'saved') return;
    if (row.state !== 'pending') throw new Error('这条草稿已放弃。');
    if (row.ended_at < buildLocalDateRange(90).fromDateTime) throw new Error('这份草稿已超出 90 天保留期。');
    const original = toPendingRecord(row, entry.generation).record;
    const record = {
      ...original,
      ...values,
      id: original.id,
      startedAt: original.startedAt,
      endedAt: original.endedAt,
    };
    await insertToiletSessionRow(db, profileId, record);
    await markCompleted(db, record.id, profileId, 'saved');
  });
  notifyLocalDataChanged();
}

export async function discardPendingToiletRecord(entry: PendingToiletRecord) {
  await commitLocalMutation(entry, async (db, profileId) => {
    await markCompleted(db, entry.record.id, profileId, 'discarded');
  });
  notifyLocalDataChanged();
}

async function markCompleted(db: SQLiteDatabase, id: string, profileId: string, state: 'saved' | 'discarded') {
  await db.runAsync(
    "UPDATE toilet_record_drafts SET state = $state, record_json = NULL, updated_at = $now WHERE id = $id AND profile_id = $profileId AND state = 'pending';",
    { $id: id, $profileId: profileId, $state: state, $now: new Date().toISOString() },
  );
}

function findDraft(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<DraftRow>(
    'SELECT profile_id, ended_at, state, record_json FROM toilet_record_drafts WHERE id = $id;',
    {
      $id: id,
    },
  );
}

function toPendingRecord(row: DraftRow, generation: number): PendingToiletRecord {
  if (!row.record_json) throw new Error('草稿内容读取失败。');
  const record = JSON.parse(row.record_json) as ToiletSession;
  return { generation, profileId: row.profile_id, record: { ...record, ...createToiletRecordDraft(record) } };
}

async function readCurrentProfile<T>(read: (db: SQLiteDatabase, profileId: string, generation: number) => Promise<T>) {
  const generation = authSessionContext.captureLocalGeneration();
  return authSessionContext.runExclusive(generation, async () => {
    const db = await initializeDatabase();
    const profileId = await getActiveLocalProfileId();
    const owner = authSessionContext.current();
    if (owner && owner.profileId !== profileId) throw new SessionChangedError();
    const value = await read(db, profileId, generation);
    authSessionContext.assertGeneration(generation);
    return value;
  });
}

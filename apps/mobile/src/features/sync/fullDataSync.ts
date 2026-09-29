import type {
  DataSyncChange,
  HabitCheckInSyncPayload,
  ToiletSessionSyncPayload,
  ToiletSignalPresetSyncPayload,
  TrainingSessionSyncPayload,
  TrainingPreferences,
} from '@xiaotidu/contracts';

import { dataSyncApi } from '../../api/client';
import { authSessionContext, SessionChangedError, type SessionSnapshot } from '../../api/sessionContext';
import { initializeDatabase } from '../../storage/db';
import {
  getDataSyncCursor,
  listPendingDataMutations,
  removeAcceptedDataMutations,
  setDataSyncCursor,
  markDataSyncCompleted,
} from '../../storage/dataSyncOutbox';
import { rebuildDailySummary } from '../data/dailyData';
import { trackGrowthEvent } from '../growth/growthEventTracker';
import { useHabitStore } from '../habits/habitStore';
import { useToiletStore } from '../toilet/toiletStore';
import { useTrainingStore } from '../training/trainingStore';
import { useTrainingPreferencesStore } from '../training/trainingPreferencesStore';
import { notifyLocalDataChanged } from './localDataEvents';
import type { SyncTaskResult } from './syncTaskResult';

let inFlight: { generation: number; promise: Promise<SyncTaskResult> } | null = null;

export function syncCompleteHealthData(): Promise<SyncTaskResult> {
  const owner = authSessionContext.current();
  if (!owner) return Promise.resolve({ outcome: 'skipped', reason: '登录后才能同步完整记录。' });
  if (inFlight?.generation === owner.generation) return inFlight.promise;
  const pending = {
    generation: owner.generation,
    promise: performCompleteHealthDataSync(owner).catch((error: unknown) => {
      if (error instanceof SessionChangedError)
        return { outcome: 'skipped' as const, reason: '账号已变更，本轮同步已停止。' };
      trackGrowthEvent('sync_failed', { domain: 'full_data' });
      throw error;
    }),
  };
  pending.promise = pending.promise.finally(() => {
    if (inFlight === pending) inFlight = null;
  });
  inFlight = pending;
  return pending.promise;
}

async function performCompleteHealthDataSync(owner: SessionSnapshot) {
  const { accessToken: token, profileId, generation } = owner;
  const readPending = () => authSessionContext.runExclusive(generation, () => listPendingDataMutations(100, profileId));

  // pull 期间可能又有本地编辑；补推后再拉取，直到本轮观察到没有待提交项。
  for (;;) {
    for (;;) {
      const mutations = await readPending();
      authSessionContext.assertCurrent(owner);
      if (mutations.length === 0) break;
      const response = await dataSyncApi.push(
        { mutations, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
        token,
      );
      authSessionContext.assertCurrent(owner);
      const requestedIds = new Set(mutations.map((mutation) => mutation.mutationId));
      const acceptedIds = response.acceptedMutationIds.filter((id) => requestedIds.has(id));
      if (acceptedIds.length === 0) throw new Error('云端暂未确认完整记录，请稍后重试。');
      const acceptedIdSet = new Set(acceptedIds);
      const acceptedEntities = new Set(
        mutations.filter((mutation) => acceptedIdSet.has(mutation.mutationId)).map(entityKey),
      );
      await authSessionContext.runExclusive(generation, async () => {
        const db = await initializeDatabase();
        await db.withTransactionAsync(async () => {
          await removeAcceptedDataMutations(acceptedIds, profileId, db);
          // ACK 与服务端版本同时落库。剩余的新 mutation 仍会阻止旧 ACK 覆盖本地内容。
          await applyRemoteChanges(
            response.changes.filter((change) => acceptedEntities.has(entityKey(change))),
            profileId,
            db,
          );
        });
      });
    }

    let cursor = await getDataSyncCursor(profileId);
    for (;;) {
      authSessionContext.assertCurrent(owner);
      const response = await dataSyncApi.pull(cursor, token);
      authSessionContext.assertCurrent(owner);
      await authSessionContext.runExclusive(generation, async () => {
        const db = await initializeDatabase();
        await db.withTransactionAsync(async () => {
          await applyRemoteChanges(response.changes, profileId, db);
          await setDataSyncCursor(response.nextCursor, profileId, db);
        });
        notifyLocalDataChanged('remote');
      });
      cursor = response.nextCursor;
      if (!response.hasMore) break;
    }
    if ((await readPending()).length === 0) break;
  }
  await authSessionContext.runExclusive(generation, reloadLocalStores);
  authSessionContext.assertCurrent(owner);
  const completed = await authSessionContext.runExclusive(generation, async () => {
    const db = await initializeDatabase();
    let marked = false;
    await db.withTransactionAsync(async () => {
      authSessionContext.assertCurrent(owner);
      marked = await markDataSyncCompleted(profileId, db);
      authSessionContext.assertCurrent(owner);
    });
    return marked;
  });
  authSessionContext.assertCurrent(owner);
  return completed
    ? { outcome: 'success' as const }
    : { outcome: 'skipped' as const, reason: '有新增更改等待下一轮同步。' };
}

function entityKey(entity: Pick<DataSyncChange, 'entityType' | 'entityId'>) {
  return JSON.stringify([entity.entityType, entity.entityId]);
}

/** 调用方负责事务；与本地写入共用会话队列，保护检查与合并不可被用户编辑穿插。 */
async function applyRemoteChanges(
  changes: DataSyncChange[],
  profileId: string,
  db: Awaited<ReturnType<typeof initializeDatabase>>,
) {
  const affectedDates = new Set<string>();
  for (const change of [...changes].sort((left, right) => left.version - right.version)) {
    const pending = await db.getFirstAsync<{ mutation_id: string }>(
      'SELECT mutation_id FROM data_sync_outbox WHERE profile_id = $profileId AND entity_type = $entityType AND entity_id = $entityId LIMIT 1;',
      { $profileId: profileId, $entityType: change.entityType, $entityId: change.entityId },
    );
    if (pending) continue;
    // 同名常用项在本地唯一：保护不同 ID 的待上传新增项，不能被远端去重删除。
    if (change.entityType === 'toilet_signal_preset' && change.operation === 'upsert' && change.payload) {
      const conflict = await db.getFirstAsync<{ id: string }>(
        `SELECT p.id FROM toilet_signal_presets p WHERE p.profile_id = $profileId AND p.label = $label COLLATE NOCASE
         AND p.id <> $entityId AND EXISTS (SELECT 1 FROM data_sync_outbox o WHERE o.profile_id = p.profile_id AND o.entity_type = 'toilet_signal_preset' AND o.entity_id = p.id AND o.operation = 'upsert') LIMIT 1;`,
        {
          $profileId: profileId,
          $label: (change.payload as ToiletSignalPresetSyncPayload).label,
          $entityId: change.entityId,
        },
      );
      if (conflict) continue;
    }
    // 远端记录可能跨日移动，旧日期和新日期的汇总都必须重建。
    if (change.entityType === 'training_session' || change.entityType === 'toilet_session') {
      const table = change.entityType === 'training_session' ? 'training_sessions' : 'toilet_sessions';
      const previous = await db.getFirstAsync<{ local_date: string | null }>(
        `SELECT local_date FROM ${table} WHERE profile_id = $profileId AND id = $id;`,
        { $profileId: profileId, $id: change.entityId },
      );
      if (previous?.local_date) affectedDates.add(previous.local_date);
    }
    const date = await applyRemoteChange(change, profileId, db);
    if (date) affectedDates.add(date);
  }
  for (const date of affectedDates) await rebuildDailySummary(date, db, profileId);
}

async function applyRemoteChange(
  change: DataSyncChange,
  profileId: string,
  db: Awaited<ReturnType<typeof initializeDatabase>>,
) {
  const now = change.serverUpdatedAt;
  if (change.entityType === 'training_preferences') {
    if (change.operation === 'upsert' && change.payload) {
      await db.runAsync(
        `INSERT INTO training_preferences (profile_id, value_json, updated_at, sync_version)
        VALUES ($profileId, $value, $now, $version) ON CONFLICT(profile_id) DO UPDATE SET
        value_json = excluded.value_json, updated_at = excluded.updated_at, sync_version = excluded.sync_version
        WHERE training_preferences.sync_version < excluded.sync_version;`,
        {
          $profileId: profileId,
          $value: JSON.stringify(change.payload as TrainingPreferences),
          $now: now,
          $version: change.version,
        },
      );
    }
    return null;
  }
  if (change.operation === 'delete') {
    if (change.entityType === 'training_session') {
      const row = await db.getFirstAsync<{ local_date: string | null }>(
        'SELECT local_date FROM training_sessions WHERE profile_id = $profileId AND id = $id;',
        { $id: change.entityId, $profileId: profileId },
      );
      await db.runAsync(
        'UPDATE training_sessions SET deleted_at = $now, updated_at = $now, sync_version = $version WHERE profile_id = $profileId AND id = $id AND sync_version < $version;',
        { $id: change.entityId, $now: now, $profileId: profileId, $version: change.version },
      );
      return row?.local_date ?? null;
    }
    if (change.entityType === 'habit_checkin') {
      await db.runAsync(
        'UPDATE habit_checkins SET deleted_at = $now, updated_at = $now, sync_version = $version WHERE profile_id = $profileId AND date = $id AND sync_version < $version;',
        { $id: change.entityId, $now: now, $profileId: profileId, $version: change.version },
      );
      return change.entityId;
    }
    if (change.entityType === 'toilet_session') {
      const row = await db.getFirstAsync<{ local_date: string | null }>(
        'SELECT local_date FROM toilet_sessions WHERE profile_id = $profileId AND id = $id;',
        { $id: change.entityId, $profileId: profileId },
      );
      await db.runAsync(
        'UPDATE toilet_sessions SET deleted_at = $now, updated_at = $now, sync_version = $version WHERE profile_id = $profileId AND id = $id AND sync_version < $version;',
        { $id: change.entityId, $now: now, $profileId: profileId, $version: change.version },
      );
      return row?.local_date ?? null;
    }
    await db.runAsync(
      'UPDATE toilet_signal_presets SET deleted_at = $now, updated_at = $now, sync_version = $version WHERE profile_id = $profileId AND id = $id AND sync_version < $version;',
      { $id: change.entityId, $now: now, $profileId: profileId, $version: change.version },
    );
    return null;
  }

  if (!change.payload) return null;
  if (change.entityType === 'training_session') {
    const payload = change.payload as TrainingSessionSyncPayload;
    await db.runAsync(
      `INSERT INTO training_sessions (id, profile_id, preset_id, started_at, ended_at, duration_seconds, completed_repetitions, is_completed, feedback, end_reason, plan_json, local_date, updated_at, deleted_at, sync_version)
       VALUES ($id, $profileId, $presetId, $startedAt, $endedAt, $duration, $repetitions, $completed, $feedback, $endReason, $plan, $localDate, $updatedAt, NULL, $version)
       ON CONFLICT(id) DO UPDATE SET preset_id = excluded.preset_id, started_at = excluded.started_at, ended_at = excluded.ended_at, duration_seconds = excluded.duration_seconds, completed_repetitions = excluded.completed_repetitions, is_completed = excluded.is_completed, feedback = excluded.feedback, end_reason = excluded.end_reason, plan_json = excluded.plan_json, local_date = excluded.local_date, updated_at = excluded.updated_at, deleted_at = NULL, sync_version = excluded.sync_version WHERE training_sessions.profile_id = excluded.profile_id AND training_sessions.sync_version < excluded.sync_version;`,
      {
        $completed: payload.isCompleted ? 1 : 0,
        $feedback: payload.feedback,
        $endReason: payload.endReason,
        $plan: JSON.stringify(payload.plan),
        $duration: payload.durationSeconds,
        $endedAt: payload.endedAt,
        $id: change.entityId,
        $localDate: payload.localDate,
        $presetId: payload.presetId,
        $profileId: profileId,
        $repetitions: payload.completedRepetitions,
        $startedAt: payload.startedAt,
        $updatedAt: now,
        $version: change.version,
      },
    );
    return payload.localDate;
  }
  if (change.entityType === 'habit_checkin') {
    const payload = change.payload as HabitCheckInSyncPayload;
    await db.runAsync(
      `INSERT INTO habit_checkins (profile_id, date, water, fiber, movement, bowel, updated_at, deleted_at, sync_version)
       VALUES ($profileId, $date, $water, $fiber, $movement, $bowel, $updatedAt, NULL, $version)
       ON CONFLICT(profile_id, date) DO UPDATE SET water = excluded.water, fiber = excluded.fiber, movement = excluded.movement, bowel = excluded.bowel, updated_at = excluded.updated_at, deleted_at = NULL, sync_version = excluded.sync_version WHERE habit_checkins.sync_version < excluded.sync_version;`,
      {
        $bowel: payload.bowel,
        $date: payload.date,
        $fiber: payload.fiber,
        $movement: payload.movement,
        $profileId: profileId,
        $updatedAt: now,
        $version: change.version,
        $water: payload.water,
      },
    );
    return payload.date;
  }
  if (change.entityType === 'toilet_session') {
    const payload = change.payload as ToiletSessionSyncPayload;
    await db.runAsync(
      `INSERT INTO toilet_sessions (id, profile_id, started_at, ended_at, duration_seconds, feeling, discomfort, bleeding, stool_shape, stool_color, signals_json, local_date, updated_at, deleted_at, sync_version)
       VALUES ($id, $profileId, $startedAt, $endedAt, $duration, $feeling, $discomfort, $bleeding, $shape, $color, $signals, $localDate, $updatedAt, NULL, $version)
       ON CONFLICT(id) DO UPDATE SET started_at = excluded.started_at, ended_at = excluded.ended_at, duration_seconds = excluded.duration_seconds, feeling = excluded.feeling, discomfort = excluded.discomfort, bleeding = excluded.bleeding, stool_shape = excluded.stool_shape, stool_color = excluded.stool_color, signals_json = excluded.signals_json, local_date = excluded.local_date, updated_at = excluded.updated_at, deleted_at = NULL, sync_version = excluded.sync_version WHERE toilet_sessions.profile_id = excluded.profile_id AND toilet_sessions.sync_version < excluded.sync_version;`,
      {
        $bleeding: payload.bleeding ? 1 : 0,
        $color: payload.stoolColor,
        $discomfort: payload.discomfort ? 1 : 0,
        $duration: payload.durationSeconds,
        $endedAt: payload.endedAt,
        $feeling: payload.feeling,
        $id: change.entityId,
        $localDate: payload.localDate,
        $profileId: profileId,
        $shape: payload.stoolShape,
        $signals: JSON.stringify(payload.signals),
        $startedAt: payload.startedAt,
        $updatedAt: now,
        $version: change.version,
      },
    );
    return payload.localDate;
  }
  const payload = change.payload as ToiletSignalPresetSyncPayload;
  await db.runAsync(
    `DELETE FROM toilet_signal_presets
     WHERE profile_id = $profileId AND label = $label COLLATE NOCASE AND id <> $id AND sync_version < $version;`,
    { $id: change.entityId, $label: payload.label, $profileId: profileId, $version: change.version },
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO toilet_signal_presets (profile_id, id, label, created_at, updated_at, deleted_at, sync_version)
     VALUES ($profileId, $id, $label, $createdAt, $updatedAt, NULL, $version);`,
    {
      $createdAt: payload.createdAt,
      $id: change.entityId,
      $label: payload.label,
      $profileId: profileId,
      $updatedAt: now,
      $version: change.version,
    },
  );
  await db.runAsync(
    `UPDATE toilet_signal_presets
     SET label = $label, updated_at = $updatedAt, deleted_at = NULL, sync_version = $version
     WHERE profile_id = $profileId AND id = $id AND sync_version < $version;`,
    {
      $id: change.entityId,
      $label: payload.label,
      $profileId: profileId,
      $updatedAt: now,
      $version: change.version,
    },
  );
  return null;
}

async function reloadLocalStores() {
  await useTrainingPreferencesStore.getState().hydrate();
  useTrainingStore.getState().reset();
  useToiletStore.getState().reset();
  useHabitStore.getState().reset();
  await Promise.all([
    useTrainingStore.getState().hydrate(),
    useToiletStore.getState().hydrate(),
    useHabitStore.getState().hydrate(),
  ]);
}

import type {
  DataSyncChange,
  HabitCheckInSyncPayload,
  ToiletSessionSyncPayload,
  ToiletSignalPresetSyncPayload,
  TrainingSessionSyncPayload,
} from '@xiaotidu/contracts';

import { dataSyncApi } from '../../api/client';
import { initializeDatabase } from '../../storage/db';
import {
  getDataSyncCursor,
  listPendingDataMutations,
  removeAcceptedDataMutations,
  setDataSyncCursor,
} from '../../storage/dataSyncOutbox';
import { getActiveLocalProfileId, getActiveProfileUserId } from '../../storage/localDataProfile';
import { rebuildDailySummary } from '../data/dailyData';
import { trackGrowthEvent } from '../growth/growthEventTracker';
import { useHabitStore } from '../habits/habitStore';
import { useToiletStore } from '../toilet/toiletStore';
import { useTrainingStore } from '../training/trainingStore';
import { useAuthStore } from '../account/authStore';
import { notifyLocalDataChanged } from './localDataEvents';

export async function syncCompleteHealthData() {
  try {
    return await performCompleteHealthDataSync();
  } catch (error) {
    trackGrowthEvent('sync_failed', { domain: 'full_data' });
    throw error;
  }
}

async function performCompleteHealthDataSync() {
  const token = useAuthStore.getState().accessToken;
  if (!token) return false;
  const profileId = await getActiveLocalProfileId();
  const activeUserId = await getActiveProfileUserId();
  if (!activeUserId) return false;

  for (;;) {
    const mutations = await listPendingDataMutations(100, profileId);
    if (mutations.length === 0) break;
    const response = await dataSyncApi.push(
      { mutations, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
      token,
    );
    if (!(await isSyncContextActive(token, profileId))) return false;
    const requestedIds = new Set(mutations.map((mutation) => mutation.mutationId));
    const acceptedIds = response.acceptedMutationIds.filter((mutationId) => requestedIds.has(mutationId));
    await removeAcceptedDataMutations(acceptedIds, profileId);
    if (acceptedIds.length === 0) throw new Error('云端暂未确认完整记录，请稍后重试。');
  }

  let cursor = await getDataSyncCursor(profileId);
  for (;;) {
    const response = await dataSyncApi.pull(cursor, token);
    if (!(await isSyncContextActive(token, profileId))) return false;
    await applyRemoteChanges(response.changes, profileId);
    cursor = response.nextCursor;
    await setDataSyncCursor(cursor, profileId);
    if (!response.hasMore) break;
  }
  if (!(await isSyncContextActive(token, profileId))) return false;
  await reloadLocalStores();
  return true;
}

async function applyRemoteChanges(changes: DataSyncChange[], profileId: string) {
  if (changes.length === 0) return;
  const db = await initializeDatabase();
  const affectedDates = new Set<string>();

  await db.withTransactionAsync(async () => {
    for (const change of changes) {
      const date = await applyRemoteChange(change, profileId, db);
      if (date) affectedDates.add(date);
    }
  });

  for (const date of affectedDates) await rebuildDailySummary(date, db, profileId);
  notifyLocalDataChanged('remote');
}

async function applyRemoteChange(
  change: DataSyncChange,
  profileId: string,
  db: Awaited<ReturnType<typeof initializeDatabase>>,
) {
  const now = change.serverUpdatedAt;
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
      `INSERT INTO training_sessions (id, profile_id, preset_id, started_at, ended_at, duration_seconds, completed_repetitions, is_completed, discomfort_reported, local_date, updated_at, deleted_at, sync_version)
       VALUES ($id, $profileId, $presetId, $startedAt, $endedAt, $duration, $repetitions, $completed, $discomfort, $localDate, $updatedAt, NULL, $version)
       ON CONFLICT(id) DO UPDATE SET preset_id = excluded.preset_id, started_at = excluded.started_at, ended_at = excluded.ended_at, duration_seconds = excluded.duration_seconds, completed_repetitions = excluded.completed_repetitions, is_completed = excluded.is_completed, discomfort_reported = excluded.discomfort_reported, local_date = excluded.local_date, updated_at = excluded.updated_at, deleted_at = NULL, sync_version = excluded.sync_version WHERE training_sessions.profile_id = excluded.profile_id AND training_sessions.sync_version < excluded.sync_version;`,
      {
        $completed: payload.isCompleted ? 1 : 0,
        $discomfort: payload.discomfortReported ? 1 : 0,
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

async function isSyncContextActive(token: string, profileId: string) {
  return useAuthStore.getState().accessToken === token && (await getActiveLocalProfileId()) === profileId;
}

async function reloadLocalStores() {
  useTrainingStore.setState({ hasHydrated: false, sessions: [] });
  useToiletStore.setState({ hasHydrated: false, sessions: [] });
  useHabitStore.setState({ checkIns: [], hasHydrated: false });
  await Promise.all([
    useTrainingStore.getState().hydrate(),
    useToiletStore.getState().hydrate(),
    useHabitStore.getState().hydrate(),
  ]);
}

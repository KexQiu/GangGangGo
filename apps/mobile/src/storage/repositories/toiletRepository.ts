import {
  isToiletStoolColor,
  isToiletStoolShape,
  MAX_CUSTOM_TOILET_SIGNAL_PRESETS,
  normalizeToiletSignalLabel,
  normalizeToiletSignals,
} from '../../features/toilet/toiletRecordLogic';
import { type ToiletFeeling, type ToiletSession, type ToiletSignalPreset } from '../../features/toilet/toiletTypes';
import { getLocalDateKey } from '../../features/habits/habitLogic';
import { rebuildDailySummary } from '../../features/data/dailyData';
import { enqueueDataMutation } from '../dataSyncOutbox';
import { getActiveLocalProfileId } from '../localDataProfile';
import { initializeDatabase } from '../db';
import { normalizePageSize, type Page } from '../pagination';
import { toiletSessionPageSql } from './pageQueries';

type ToiletSessionRow = {
  bleeding: number;
  discomfort: number;
  duration_seconds: number;
  ended_at: string;
  feeling: string;
  id: string;
  signals_json: string | null;
  started_at: string;
  stool_color: string | null;
  stool_shape: string | null;
};

type ToiletSignalPresetRow = {
  created_at: string;
  id: string;
  label: string;
  updated_at: string;
};

const toiletFeelings = new Set<ToiletFeeling>(['smooth', 'normal', 'difficult']);

export type ToiletSessionCursor = {
  endedAt: string;
  id: string;
};

export type ToiletSessionPageOptions = {
  cursor?: ToiletSessionCursor;
  fromDateTime?: string;
  limit?: number;
  toDateTimeExclusive?: string;
};

export async function insertToiletSession(session: ToiletSession): Promise<void> {
  const db = await initializeDatabase();
  const profileId = await getActiveLocalProfileId();
  const localDate = getLocalDateKey(new Date(session.endedAt));
  const updatedAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `
      INSERT INTO toilet_sessions (
        id,
        started_at,
        ended_at,
        duration_seconds,
        feeling,
        discomfort,
        bleeding,
        stool_shape,
        stool_color,
        signals_json,
        profile_id,
        local_date,
        updated_at
      ) VALUES (
        $id,
        $startedAt,
        $endedAt,
        $durationSeconds,
        $feeling,
        $discomfort,
        $bleeding,
        $stoolShape,
        $stoolColor,
        $signalsJson,
        $profileId,
        $localDate,
        $updatedAt
      );
    `,
      {
        $bleeding: session.bleeding ? 1 : 0,
        $discomfort: session.discomfort ? 1 : 0,
        $durationSeconds: session.durationSeconds,
        $endedAt: session.endedAt,
        $feeling: session.feeling,
        $id: session.id,
        $localDate: localDate,
        $profileId: profileId,
        $signalsJson: JSON.stringify(normalizeToiletSignals(session.signals)),
        $startedAt: session.startedAt,
        $stoolColor: session.stoolColor ?? null,
        $stoolShape: session.stoolShape ?? null,
        $updatedAt: updatedAt,
      },
    );
    await enqueueDataMutation(
      {
        entityId: session.id,
        entityType: 'toilet_session',
        operation: 'upsert',
        payload: toSyncPayload(session, localDate),
      },
      db,
      profileId,
    );
  });
  await rebuildDailySummary(localDate);
}

export async function updateToiletSession(session: ToiletSession): Promise<void> {
  const db = await initializeDatabase();
  const profileId = await getActiveLocalProfileId();
  const localDate = getLocalDateKey(new Date(session.endedAt));
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `
      UPDATE toilet_sessions
      SET
        duration_seconds = $durationSeconds,
        feeling = $feeling,
        discomfort = $discomfort,
        bleeding = $bleeding,
        stool_shape = $stoolShape,
        stool_color = $stoolColor,
        signals_json = $signalsJson,
        local_date = $localDate,
        updated_at = $updatedAt
      WHERE id = $id AND profile_id = $profileId AND deleted_at IS NULL;
    `,
      {
        $bleeding: session.bleeding ? 1 : 0,
        $discomfort: session.discomfort ? 1 : 0,
        $durationSeconds: session.durationSeconds,
        $feeling: session.feeling,
        $id: session.id,
        $localDate: localDate,
        $profileId: profileId,
        $signalsJson: JSON.stringify(normalizeToiletSignals(session.signals)),
        $stoolColor: session.stoolColor ?? null,
        $stoolShape: session.stoolShape ?? null,
        $updatedAt: new Date().toISOString(),
      },
    );
    if (result.changes === 0) throw new Error('未找到需要更新的如厕记录');
    await enqueueDataMutation(
      {
        entityId: session.id,
        entityType: 'toilet_session',
        operation: 'upsert',
        payload: toSyncPayload(session, localDate),
      },
      db,
      profileId,
    );
  });
  await rebuildDailySummary(localDate);
}

export async function deleteToiletSession(id: string): Promise<void> {
  const db = await initializeDatabase();
  const profileId = await getActiveLocalProfileId();
  let localDate: string | null = null;
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ local_date: string | null }>(
      'SELECT local_date FROM toilet_sessions WHERE id = $id AND profile_id = $profileId;',
      { $id: id, $profileId: profileId },
    );
    localDate = row?.local_date ?? null;
    const result = await db.runAsync(
      'UPDATE toilet_sessions SET deleted_at = $now, updated_at = $now WHERE id = $id AND profile_id = $profileId AND deleted_at IS NULL;',
      { $id: id, $now: new Date().toISOString(), $profileId: profileId },
    );
    if (result.changes === 0) throw new Error('未找到需要删除的如厕记录');
    await enqueueDataMutation(
      { entityId: id, entityType: 'toilet_session', operation: 'delete', payload: null },
      db,
      profileId,
    );
  });
  if (localDate) await rebuildDailySummary(localDate);
}

export async function getToiletSession(id: string): Promise<ToiletSession | null> {
  const db = await initializeDatabase();
  const profileId = await getActiveLocalProfileId();
  const row = await db.getFirstAsync<ToiletSessionRow>(
    `
      SELECT
        id,
        started_at,
        ended_at,
        duration_seconds,
        feeling,
        discomfort,
        bleeding,
        stool_shape,
        stool_color,
        signals_json
      FROM toilet_sessions
      WHERE id = $id AND profile_id = $profileId AND deleted_at IS NULL;
    `,
    { $id: id, $profileId: profileId },
  );

  return row ? rowToToiletSession(row) : null;
}

export async function listToiletSignalPresets(): Promise<ToiletSignalPreset[]> {
  const db = await initializeDatabase();
  const profileId = await getActiveLocalProfileId();
  const rows = await db.getAllAsync<ToiletSignalPresetRow>(
    `
      SELECT id, label, created_at, updated_at
      FROM toilet_signal_presets
      WHERE profile_id = $profileId AND deleted_at IS NULL
      ORDER BY updated_at DESC, created_at DESC;
    `,
    { $profileId: profileId },
  );

  return rows.map(rowToToiletSignalPreset);
}

export async function createToiletSignalPreset(label: string): Promise<ToiletSignalPreset> {
  const normalizedLabel = normalizeToiletSignalLabel(label);
  if (!normalizedLabel) throw new Error('请输入自定义小信号');

  const db = await initializeDatabase();
  const profileId = await getActiveLocalProfileId();
  const existing = await db.getFirstAsync<ToiletSignalPresetRow>(
    `
      SELECT id, label, created_at, updated_at
      FROM toilet_signal_presets
      WHERE profile_id = $profileId AND label = $label COLLATE NOCASE AND deleted_at IS NULL;
    `,
    { $label: normalizedLabel, $profileId: profileId },
  );
  if (existing) return rowToToiletSignalPreset(existing);

  const countRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM toilet_signal_presets WHERE profile_id = $profileId AND deleted_at IS NULL;',
    { $profileId: profileId },
  );
  if ((countRow?.count ?? 0) >= MAX_CUSTOM_TOILET_SIGNAL_PRESETS) {
    throw new Error(`最多保留 ${MAX_CUSTOM_TOILET_SIGNAL_PRESETS} 个自定义常用项`);
  }

  const now = new Date().toISOString();
  const preset: ToiletSignalPreset = {
    createdAt: now,
    id: createToiletSignalPresetId(),
    label: normalizedLabel,
    updatedAt: now,
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `
      INSERT INTO toilet_signal_presets (profile_id, id, label, created_at, updated_at)
      VALUES ($profileId, $id, $label, $createdAt, $updatedAt);
    `,
      {
        $createdAt: preset.createdAt,
        $id: preset.id,
        $label: preset.label,
        $profileId: profileId,
        $updatedAt: preset.updatedAt,
      },
    );
    await enqueueDataMutation(
      {
        entityId: preset.id,
        entityType: 'toilet_signal_preset',
        operation: 'upsert',
        payload: { createdAt: preset.createdAt, label: preset.label },
      },
      db,
      profileId,
    );
  });

  return preset;
}

export async function deleteToiletSignalPreset(id: string): Promise<void> {
  const db = await initializeDatabase();
  const profileId = await getActiveLocalProfileId();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE toilet_signal_presets SET deleted_at = $now, updated_at = $now WHERE id = $id AND profile_id = $profileId;',
      { $id: id, $now: now, $profileId: profileId },
    );
    await enqueueDataMutation(
      { entityId: id, entityType: 'toilet_signal_preset', operation: 'delete', payload: null },
      db,
      profileId,
    );
  });
}

export async function listToiletSessionsPage(
  options: ToiletSessionPageOptions = {},
): Promise<Page<ToiletSession, ToiletSessionCursor>> {
  const db = await initializeDatabase();
  const limit = normalizePageSize(options.limit);
  const rows = await db.getAllAsync<ToiletSessionRow>(toiletSessionPageSql, {
    $cursorEndedAt: options.cursor?.endedAt ?? null,
    $cursorId: options.cursor?.id ?? null,
    $fromDateTime: options.fromDateTime ?? null,
    $queryLimit: limit + 1,
    $toDateTimeExclusive: options.toDateTimeExclusive ?? null,
  });
  const pageRows = rows.slice(0, limit);
  const lastRow = pageRows.at(-1);

  return {
    items: pageRows.map(rowToToiletSession).filter((session): session is ToiletSession => Boolean(session)),
    nextCursor:
      rows.length > limit && lastRow
        ? {
            endedAt: lastRow.ended_at,
            id: lastRow.id,
          }
        : null,
  };
}

function rowToToiletSession(row: ToiletSessionRow): ToiletSession | null {
  if (!toiletFeelings.has(row.feeling as ToiletFeeling)) {
    return null;
  }

  return {
    bleeding: Boolean(row.bleeding),
    discomfort: Boolean(row.discomfort),
    durationSeconds: row.duration_seconds,
    endedAt: row.ended_at,
    feeling: row.feeling as ToiletFeeling,
    id: row.id,
    signals: parseToiletSignals(row.signals_json),
    startedAt: row.started_at,
    stoolColor: isToiletStoolColor(row.stool_color) ? row.stool_color : null,
    stoolShape: isToiletStoolShape(row.stool_shape) ? row.stool_shape : null,
  };
}

function parseToiletSignals(value: string | null): ToiletSession['signals'] {
  if (!value) return [];

  try {
    return normalizeToiletSignals(JSON.parse(value));
  } catch {
    return [];
  }
}

function rowToToiletSignalPreset(row: ToiletSignalPresetRow): ToiletSignalPreset {
  return {
    createdAt: row.created_at,
    id: row.id,
    label: row.label,
    updatedAt: row.updated_at,
  };
}

function createToiletSignalPresetId(): string {
  return `signal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toSyncPayload(session: ToiletSession, localDate: string) {
  return {
    bleeding: session.bleeding,
    discomfort: session.discomfort,
    durationSeconds: session.durationSeconds,
    endedAt: session.endedAt,
    feeling: session.feeling,
    localDate,
    signals: normalizeToiletSignals(session.signals),
    startedAt: session.startedAt,
    stoolColor: session.stoolColor ?? null,
    stoolShape: session.stoolShape ?? null,
  };
}

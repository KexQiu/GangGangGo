import type { DataSyncEntityType, DataSyncMutation, DataSyncPayload } from '@xiaotidu/contracts';

import { initializeDatabase } from './db';
import { getActiveLocalProfileId } from './localDataProfile';

export async function enqueueDataMutation(
  input: {
    entityId: string;
    entityType: DataSyncEntityType;
    operation: 'delete' | 'upsert';
    payload: DataSyncPayload | null;
  },
  database?: Awaited<ReturnType<typeof initializeDatabase>>,
  providedProfileId?: string,
) {
  const db = database ?? (await initializeDatabase());
  const profileId = providedProfileId ?? (await getActiveLocalProfileId());
  const changedAt = new Date().toISOString();
  const mutationId = `${input.entityType}-${input.entityId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await db.runAsync(
    `
      INSERT INTO data_sync_outbox (
        mutation_id, profile_id, entity_type, entity_id, operation, payload_json, changed_at
      ) VALUES ($mutationId, $profileId, $entityType, $entityId, $operation, $payloadJson, $changedAt);
    `,
    {
      $changedAt: changedAt,
      $entityId: input.entityId,
      $entityType: input.entityType,
      $mutationId: mutationId,
      $operation: input.operation,
      $payloadJson: input.payload ? JSON.stringify(input.payload) : null,
      $profileId: profileId,
    },
  );
}

export async function listPendingDataMutations(limit = 100, providedProfileId?: string): Promise<DataSyncMutation[]> {
  const db = await initializeDatabase();
  const profileId = providedProfileId ?? (await getActiveLocalProfileId());
  const rows = await db.getAllAsync<{
    changed_at: string;
    entity_id: string;
    entity_type: DataSyncEntityType;
    mutation_id: string;
    operation: 'delete' | 'upsert';
    payload_json: string | null;
  }>(
    `
      SELECT mutation_id, entity_type, entity_id, operation, payload_json, changed_at
      FROM data_sync_outbox
      WHERE profile_id = $profileId
      ORDER BY sequence
      LIMIT $limit;
    `,
    { $limit: Math.max(1, Math.min(100, limit)), $profileId: profileId },
  );

  return rows.map((row) =>
    row.operation === 'delete'
      ? {
          changedAt: row.changed_at,
          entityId: row.entity_id,
          entityType: row.entity_type,
          mutationId: row.mutation_id,
          operation: 'delete' as const,
          payload: null,
        }
      : {
          changedAt: row.changed_at,
          entityId: row.entity_id,
          entityType: row.entity_type,
          mutationId: row.mutation_id,
          operation: 'upsert' as const,
          payload: JSON.parse(row.payload_json ?? '{}') as DataSyncPayload,
        },
  );
}

export async function removeAcceptedDataMutations(
  mutationIds: string[],
  providedProfileId?: string,
  database?: Awaited<ReturnType<typeof initializeDatabase>>,
) {
  if (mutationIds.length === 0) return;
  const db = database ?? (await initializeDatabase());
  const profileId = providedProfileId ?? (await getActiveLocalProfileId());
  const placeholders = mutationIds.map((_, index) => `$id${index}`).join(', ');
  await db.runAsync(
    `DELETE FROM data_sync_outbox WHERE profile_id = $profileId AND mutation_id IN (${placeholders});`,
    { $profileId: profileId, ...Object.fromEntries(mutationIds.map((id, index) => [`$id${index}`, id])) },
  );
}

export async function getDataSyncCursor(providedProfileId?: string) {
  const db = await initializeDatabase();
  const profileId = providedProfileId ?? (await getActiveLocalProfileId());
  const row = await db.getFirstAsync<{ cursor: string }>(
    'SELECT cursor FROM data_sync_state WHERE profile_id = $profileId;',
    { $profileId: profileId },
  );
  return row?.cursor ?? '0';
}

export async function setDataSyncCursor(
  cursor: string,
  providedProfileId?: string,
  database?: Awaited<ReturnType<typeof initializeDatabase>>,
) {
  const db = database ?? (await initializeDatabase());
  const profileId = providedProfileId ?? (await getActiveLocalProfileId());
  await db.runAsync(
    `
      INSERT INTO data_sync_state (profile_id, cursor, last_synced_at)
      VALUES ($profileId, $cursor, $now)
      ON CONFLICT(profile_id) DO UPDATE SET cursor = excluded.cursor, last_synced_at = excluded.last_synced_at;
    `,
    { $cursor: cursor, $now: new Date().toISOString(), $profileId: profileId },
  );
}

export type DataSyncOverview = { pendingCount: number; lastCompletedAt: string | null };

/** 调用方持有当前会话的本地队列，避免读到未提交的 outbox。 */
export async function readDataSyncOverview(profileId: string): Promise<DataSyncOverview> {
  const db = await initializeDatabase();
  const count = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM data_sync_outbox WHERE profile_id = $profileId;',
    { $profileId: profileId },
  );
  const state = await db.getFirstAsync<{ last_completed_at: string | null }>(
    'SELECT last_completed_at FROM data_sync_state WHERE profile_id = $profileId;',
    { $profileId: profileId },
  );
  return { pendingCount: Number(count?.count ?? 0), lastCompletedAt: state?.last_completed_at ?? null };
}

/** 调用方负责事务；游标推进不等于整轮完成，新增待提交项也不能被标为完成。 */
export async function markDataSyncCompleted(profileId: string, db: Awaited<ReturnType<typeof initializeDatabase>>) {
  const pending = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM data_sync_outbox WHERE profile_id = $profileId;',
    { $profileId: profileId },
  );
  if (Number(pending?.count ?? 0) > 0) return false;
  await db.runAsync(
    `INSERT INTO data_sync_state (profile_id, last_completed_at) VALUES ($profileId, $now)
     ON CONFLICT(profile_id) DO UPDATE SET last_completed_at = excluded.last_completed_at;`,
    { $profileId: profileId, $now: new Date().toISOString() },
  );
  return true;
}

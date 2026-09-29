import type { SQLiteDatabase } from 'expo-sqlite';
import { enqueueDataMutation } from './dataSyncOutbox';

export async function mergeAnonymousProfile(db: SQLiteDatabase, sourceProfileId: string, targetProfileId: string) {
  const parameters = { $sourceProfileId: sourceProfileId, $targetProfileId: targetProfileId };
  const sourcePreferences = await db.getFirstAsync<{ value_json: string; updated_at: string }>(
    'SELECT value_json, updated_at FROM training_preferences WHERE profile_id = $profileId;',
    { $profileId: sourceProfileId },
  );
  const targetPreferences = await db.getFirstAsync<{ updated_at: string }>(
    'SELECT updated_at FROM training_preferences WHERE profile_id = $profileId;',
    { $profileId: targetProfileId },
  );
  const useSourcePreferences =
    sourcePreferences && (!targetPreferences || sourcePreferences.updated_at >= targetPreferences.updated_at);
  // 资料合并只上传最终选中的配置，不能重放被舍弃的旧配置。
  await db.runAsync(
    "DELETE FROM data_sync_outbox WHERE profile_id = $profileId AND entity_type = 'training_preferences';",
    { $profileId: sourceProfileId },
  );
  if (useSourcePreferences) {
    await db.runAsync(
      "DELETE FROM data_sync_outbox WHERE profile_id = $profileId AND entity_type = 'training_preferences';",
      { $profileId: targetProfileId },
    );
    await enqueueDataMutation(
      {
        entityType: 'training_preferences',
        entityId: 'preferences',
        operation: 'upsert',
        payload: JSON.parse(sourcePreferences.value_json),
      },
      db,
      targetProfileId,
    );
  }
  await db.runAsync(
    `INSERT INTO training_preferences (profile_id, value_json, updated_at, sync_version)
    SELECT $targetProfileId, value_json, updated_at, sync_version FROM training_preferences WHERE profile_id = $sourceProfileId
    ON CONFLICT(profile_id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, sync_version = 0
    WHERE excluded.updated_at >= training_preferences.updated_at;`,
    parameters,
  );
  await db.runAsync(
    'UPDATE training_sessions SET profile_id = $targetProfileId WHERE profile_id = $sourceProfileId;',
    parameters,
  );
  await db.runAsync(
    'UPDATE toilet_sessions SET profile_id = $targetProfileId WHERE profile_id = $sourceProfileId;',
    parameters,
  );
  await db.runAsync(
    'UPDATE toilet_record_drafts SET profile_id = $targetProfileId WHERE profile_id = $sourceProfileId;',
    parameters,
  );
  await db.runAsync(
    `
      INSERT INTO habit_checkins (
        profile_id, date, water, fiber, movement, bowel, updated_at, deleted_at, sync_version
      )
      SELECT $targetProfileId, date, water, fiber, movement, bowel, updated_at, deleted_at, sync_version
      FROM habit_checkins
      WHERE profile_id = $sourceProfileId
      ON CONFLICT(profile_id, date) DO UPDATE SET
        water = excluded.water,
        fiber = excluded.fiber,
        movement = excluded.movement,
        bowel = excluded.bowel,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        sync_version = excluded.sync_version
      WHERE excluded.updated_at >= habit_checkins.updated_at;
    `,
    parameters,
  );
  await db.runAsync(
    `
      INSERT OR IGNORE INTO toilet_signal_presets (
        profile_id, id, label, created_at, updated_at, deleted_at, sync_version
      )
      SELECT $targetProfileId, id, label, created_at, updated_at, deleted_at, sync_version
      FROM toilet_signal_presets
      WHERE profile_id = $sourceProfileId;
    `,
    parameters,
  );
  await db.runAsync(
    'UPDATE data_sync_outbox SET profile_id = $targetProfileId WHERE profile_id = $sourceProfileId;',
    parameters,
  );
  await db.runAsync('DELETE FROM local_data_profiles WHERE id = $sourceProfileId;', {
    $sourceProfileId: sourceProfileId,
  });
}

import type { SQLiteDatabase } from 'expo-sqlite';

export async function mergeAnonymousProfile(db: SQLiteDatabase, sourceProfileId: string, targetProfileId: string) {
  const parameters = { $sourceProfileId: sourceProfileId, $targetProfileId: targetProfileId };
  await db.runAsync(
    'UPDATE training_sessions SET profile_id = $targetProfileId WHERE profile_id = $sourceProfileId;',
    parameters,
  );
  await db.runAsync(
    'UPDATE toilet_sessions SET profile_id = $targetProfileId WHERE profile_id = $sourceProfileId;',
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

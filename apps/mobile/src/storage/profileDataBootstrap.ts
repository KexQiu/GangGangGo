import type { SQLiteDatabase } from 'expo-sqlite';

export async function enqueueUnsyncedProfileData(db: SQLiteDatabase, profileId: string) {
  const parameters = { $profileId: profileId };
  await db.runAsync(
    `
      INSERT INTO data_sync_outbox (
        mutation_id, profile_id, entity_type, entity_id, operation, payload_json, changed_at
      )
      SELECT
        'bootstrap-' || lower(hex(randomblob(16))),
        profile_id,
        'training_session',
        id,
        'upsert',
        json_object(
          'completedRepetitions', completed_repetitions,
          'discomfortReported', json(CASE WHEN discomfort_reported <> 0 THEN 'true' ELSE 'false' END),
          'durationSeconds', duration_seconds,
          'endedAt', ended_at,
          'isCompleted', json(CASE WHEN is_completed <> 0 THEN 'true' ELSE 'false' END),
          'localDate', local_date,
          'presetId', preset_id,
          'startedAt', started_at
        ),
        updated_at
      FROM training_sessions record
      WHERE profile_id = $profileId
        AND deleted_at IS NULL
        AND local_date IS NOT NULL
        AND local_date >= date('now', 'localtime', '-89 days')
        AND sync_version = 0
        AND NOT EXISTS (
          SELECT 1 FROM data_sync_outbox outbox
          WHERE outbox.profile_id = record.profile_id
            AND outbox.entity_type = 'training_session'
            AND outbox.entity_id = record.id
            AND outbox.operation = 'upsert'
        );
    `,
    parameters,
  );
  await db.runAsync(
    `
      INSERT INTO data_sync_outbox (
        mutation_id, profile_id, entity_type, entity_id, operation, payload_json, changed_at
      )
      SELECT
        'bootstrap-' || lower(hex(randomblob(16))),
        profile_id,
        'habit_checkin',
        date,
        'upsert',
        json_object('bowel', bowel, 'date', date, 'fiber', fiber, 'movement', movement, 'water', water),
        updated_at
      FROM habit_checkins record
      WHERE profile_id = $profileId
        AND deleted_at IS NULL
        AND date >= date('now', 'localtime', '-89 days')
        AND sync_version = 0
        AND NOT EXISTS (
          SELECT 1 FROM data_sync_outbox outbox
          WHERE outbox.profile_id = record.profile_id
            AND outbox.entity_type = 'habit_checkin'
            AND outbox.entity_id = record.date
            AND outbox.operation = 'upsert'
        );
    `,
    parameters,
  );
  await db.runAsync(
    `
      INSERT INTO data_sync_outbox (
        mutation_id, profile_id, entity_type, entity_id, operation, payload_json, changed_at
      )
      SELECT
        'bootstrap-' || lower(hex(randomblob(16))),
        profile_id,
        'toilet_session',
        id,
        'upsert',
        json_object(
          'bleeding', json(CASE WHEN bleeding <> 0 THEN 'true' ELSE 'false' END),
          'discomfort', json(CASE WHEN discomfort <> 0 THEN 'true' ELSE 'false' END),
          'durationSeconds', duration_seconds,
          'endedAt', ended_at,
          'feeling', feeling,
          'localDate', local_date,
          'signals', json(COALESCE(signals_json, '[]')),
          'startedAt', started_at,
          'stoolColor', stool_color,
          'stoolShape', stool_shape
        ),
        updated_at
      FROM toilet_sessions record
      WHERE profile_id = $profileId
        AND deleted_at IS NULL
        AND local_date IS NOT NULL
        AND local_date >= date('now', 'localtime', '-89 days')
        AND sync_version = 0
        AND NOT EXISTS (
          SELECT 1 FROM data_sync_outbox outbox
          WHERE outbox.profile_id = record.profile_id
            AND outbox.entity_type = 'toilet_session'
            AND outbox.entity_id = record.id
            AND outbox.operation = 'upsert'
        );
    `,
    parameters,
  );
  await db.runAsync(
    `
      INSERT INTO data_sync_outbox (
        mutation_id, profile_id, entity_type, entity_id, operation, payload_json, changed_at
      )
      SELECT
        'bootstrap-' || lower(hex(randomblob(16))),
        profile_id,
        'toilet_signal_preset',
        id,
        'upsert',
        json_object('createdAt', created_at, 'label', label),
        updated_at
      FROM toilet_signal_presets record
      WHERE profile_id = $profileId
        AND deleted_at IS NULL
        AND sync_version = 0
        AND NOT EXISTS (
          SELECT 1 FROM data_sync_outbox outbox
          WHERE outbox.profile_id = record.profile_id
            AND outbox.entity_type = 'toilet_signal_preset'
            AND outbox.entity_id = record.id
            AND outbox.operation = 'upsert'
        );
    `,
    parameters,
  );
}

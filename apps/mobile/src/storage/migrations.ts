import { type SQLiteDatabase } from 'expo-sqlite';

const latestVersion = 5;

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const version = row?.user_version ?? 0;
  if (version === latestVersion) return;
  if (![0, 1, 2, 3, 4].includes(version)) throw new Error(`Unsupported database version: ${version}`);

  await db.withTransactionAsync(async () => {
    if (version === 0)
      await db.execAsync(`
      CREATE TABLE app_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE daily_activity_summaries (
        profile_id TEXT NOT NULL,
        date TEXT NOT NULL,
        training_completed_count INTEGER NOT NULL DEFAULT 0,
        training_total_duration_seconds INTEGER NOT NULL DEFAULT 0,
        training_completed_repetitions INTEGER NOT NULL DEFAULT 0,
        habit_water TEXT,
        habit_fiber TEXT,
        habit_movement TEXT,
        habit_bowel TEXT,
        habit_completion_count INTEGER NOT NULL DEFAULT 0,
        toilet_session_count INTEGER NOT NULL DEFAULT 0,
        toilet_total_duration_seconds INTEGER NOT NULL DEFAULT 0,
        toilet_median_duration_seconds INTEGER NOT NULL DEFAULT 0,
        toilet_long_session_count INTEGER NOT NULL DEFAULT 0,
        toilet_attention_count INTEGER NOT NULL DEFAULT 0,
        toilet_feeling_counts_json TEXT NOT NULL DEFAULT '{}',
        toilet_shape_counts_json TEXT NOT NULL DEFAULT '{}',
        toilet_color_counts_json TEXT NOT NULL DEFAULT '{}',
        toilet_signal_counts_json TEXT NOT NULL DEFAULT '{}',
        computed_at TEXT NOT NULL,
        toilet_max_duration_seconds INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (profile_id, date),
        FOREIGN KEY (profile_id) REFERENCES local_data_profiles(id) ON DELETE CASCADE
      );

      CREATE TABLE data_sync_outbox (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        mutation_id TEXT NOT NULL UNIQUE,
        profile_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload_json TEXT,
        changed_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES local_data_profiles(id) ON DELETE CASCADE
      );

      CREATE TABLE data_sync_state (
        profile_id TEXT PRIMARY KEY NOT NULL,
        cursor TEXT NOT NULL DEFAULT '0',
        last_synced_at TEXT,
        FOREIGN KEY (profile_id) REFERENCES local_data_profiles(id) ON DELETE CASCADE
      );

      CREATE TABLE growth_event_outbox (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        installation_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        platform TEXT NOT NULL,
        app_version TEXT NOT NULL,
        properties_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE habit_checkins (
        profile_id TEXT NOT NULL DEFAULT 'local-default',
        date TEXT NOT NULL,
        water TEXT,
        fiber TEXT,
        movement TEXT,
        bowel TEXT,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        sync_version INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (profile_id, date),
        FOREIGN KEY (profile_id) REFERENCES local_data_profiles(id) ON DELETE CASCADE
      );

      CREATE TABLE local_data_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE reminder_settings (
        id TEXT PRIMARY KEY NOT NULL,
        kegel_enabled INTEGER NOT NULL DEFAULT 0,
        kegel_times TEXT NOT NULL,
        sedentary_enabled INTEGER NOT NULL DEFAULT 0,
        sedentary_interval_minutes INTEGER NOT NULL DEFAULT 60,
        privacy_mode INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        quiet_hours_ranges TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE toilet_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        feeling TEXT NOT NULL,
        discomfort INTEGER NOT NULL DEFAULT 0,
        bleeding INTEGER NOT NULL DEFAULT 0,
        stool_shape TEXT,
        stool_color TEXT,
        signals_json TEXT NOT NULL DEFAULT '[]',
        profile_id TEXT NOT NULL DEFAULT 'local-default',
        local_date TEXT,
        updated_at TEXT NOT NULL DEFAULT '',
        deleted_at TEXT,
        sync_version INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE toilet_signal_presets (
        profile_id TEXT NOT NULL DEFAULT 'local-default',
        id TEXT NOT NULL,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        sync_version INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (profile_id, id),
        FOREIGN KEY (profile_id) REFERENCES local_data_profiles(id) ON DELETE CASCADE
      );

      CREATE TABLE training_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        preset_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        completed_repetitions INTEGER NOT NULL,
        is_completed INTEGER NOT NULL,
        discomfort_reported INTEGER NOT NULL DEFAULT 0,
        profile_id TEXT NOT NULL DEFAULT 'local-default',
        local_date TEXT,
        updated_at TEXT NOT NULL DEFAULT '',
        deleted_at TEXT,
        sync_version INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX idx_daily_activity_summaries_profile_date
      ON daily_activity_summaries (profile_id, date DESC);

      CREATE INDEX idx_data_sync_outbox_profile_sequence
      ON data_sync_outbox (profile_id, sequence);

      CREATE INDEX idx_growth_event_outbox_sequence
      ON growth_event_outbox (sequence);

      CREATE INDEX idx_habit_checkins_profile_date ON habit_checkins (profile_id, date DESC);

      CREATE INDEX idx_toilet_sessions_ended_at_id
      ON toilet_sessions (ended_at DESC, id DESC);

      CREATE INDEX idx_toilet_sessions_profile_date
      ON toilet_sessions (profile_id, local_date DESC, id DESC);

      CREATE INDEX idx_toilet_sessions_profile_ended_at_id
      ON toilet_sessions (profile_id, ended_at DESC, id DESC);

      CREATE UNIQUE INDEX idx_toilet_signal_presets_profile_label
      ON toilet_signal_presets (profile_id, label COLLATE NOCASE);

      CREATE INDEX idx_training_sessions_ended_at_id
      ON training_sessions (ended_at DESC, id DESC);

      CREATE INDEX idx_training_sessions_profile_date
      ON training_sessions (profile_id, local_date DESC, id DESC);

      CREATE INDEX idx_training_sessions_profile_ended_at_id
      ON training_sessions (profile_id, ended_at DESC, id DESC);

      INSERT INTO local_data_profiles (id, user_id, created_at, updated_at)
      VALUES ('local-default', NULL, datetime('now'), datetime('now'));
      INSERT INTO app_metadata (key, value) VALUES ('active_profile_id', 'local-default');
      PRAGMA user_version = 1;
    `);
    if (version < 2)
      await db.execAsync(`
      CREATE TABLE watch_event_receipts (
        profile_id TEXT NOT NULL REFERENCES local_data_profiles(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL,
        event_json TEXT NOT NULL,
        processed_at TEXT NOT NULL,
        PRIMARY KEY (profile_id, event_id)
      );
      CREATE INDEX idx_watch_event_receipts_processed_at ON watch_event_receipts (processed_at);
      PRAGMA user_version = 2;
    `);
    if (version < 3)
      await db.execAsync(`
      CREATE TABLE toilet_record_drafts (
        id TEXT PRIMARY KEY NOT NULL,
        profile_id TEXT NOT NULL REFERENCES local_data_profiles(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('pending', 'saved', 'discarded')),
        record_json TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_toilet_record_drafts_profile_state ON toilet_record_drafts (profile_id, state, ended_at DESC);
      PRAGMA user_version = 3;
    `);
    if (version < 4)
      await db.execAsync('ALTER TABLE data_sync_state ADD COLUMN last_completed_at TEXT; PRAGMA user_version = 4;');
    await db.execAsync(trainingV5Migration);
  });
}

// 仅升级时转换；运行中的读取和同步只接受新契约。
const trainingV5Migration = `
ALTER TABLE training_sessions ADD COLUMN feedback TEXT NOT NULL DEFAULT 'unanswered';
ALTER TABLE training_sessions ADD COLUMN end_reason TEXT NOT NULL DEFAULT 'user_stopped';
ALTER TABLE training_sessions ADD COLUMN plan_json TEXT NOT NULL DEFAULT '{}';
UPDATE training_sessions SET
  feedback = CASE WHEN discomfort_reported <> 0 THEN 'reported' ELSE 'unanswered' END,
  end_reason = CASE WHEN is_completed <> 0 THEN 'completed' ELSE 'user_stopped' END,
  plan_json = CASE preset_id
    WHEN 'beginner' THEN '{"contractSeconds":3,"relaxSeconds":3,"repetitions":10}'
    WHEN 'standard' THEN '{"contractSeconds":5,"relaxSeconds":5,"repetitions":12}'
    ELSE '{"contractSeconds":1,"relaxSeconds":1,"repetitions":16}' END;
UPDATE training_sessions SET completed_repetitions = json_extract(plan_json, '$.repetitions')
  WHERE id LIKE 'watch-%' AND is_completed = 1 AND completed_repetitions = 1
  AND duration_seconds = (json_extract(plan_json, '$.contractSeconds') + json_extract(plan_json, '$.relaxSeconds')) * json_extract(plan_json, '$.repetitions');
ALTER TABLE training_sessions DROP COLUMN discomfort_reported;
UPDATE data_sync_outbox SET payload_json = json_set(json_remove(payload_json, '$.discomfortReported'),
 '$.feedback', CASE WHEN json_extract(payload_json, '$.discomfortReported') = 1 THEN 'reported' ELSE 'unanswered' END,
 '$.endReason', CASE WHEN json_extract(payload_json, '$.isCompleted') = 1 THEN 'completed' ELSE 'user_stopped' END,
 '$.plan', json(CASE json_extract(payload_json, '$.presetId')
  WHEN 'beginner' THEN '{"contractSeconds":3,"relaxSeconds":3,"repetitions":10}'
  WHEN 'standard' THEN '{"contractSeconds":5,"relaxSeconds":5,"repetitions":12}'
  ELSE '{"contractSeconds":1,"relaxSeconds":1,"repetitions":16}' END))
 WHERE entity_type = 'training_session' AND operation = 'upsert';
UPDATE data_sync_outbox SET payload_json = json_set(payload_json, '$.completedRepetitions', json_extract(payload_json, '$.plan.repetitions'))
 WHERE entity_type = 'training_session' AND operation = 'upsert' AND entity_id LIKE 'watch-%'
 AND json_extract(payload_json, '$.isCompleted') = 1 AND json_extract(payload_json, '$.completedRepetitions') = 1
 AND json_extract(payload_json, '$.durationSeconds') = (json_extract(payload_json, '$.plan.contractSeconds') + json_extract(payload_json, '$.plan.relaxSeconds')) * json_extract(payload_json, '$.plan.repetitions');
UPDATE watch_event_receipts SET event_json = json_set(event_json, '$.schemaVersion', 4)
 WHERE json_extract(event_json, '$.schemaVersion') = 3
 AND json_extract(event_json, '$.type') IN ('habit_toggled', 'toilet_timer_action');
ALTER TABLE daily_activity_summaries ADD COLUMN training_session_count INTEGER NOT NULL DEFAULT 0;
UPDATE daily_activity_summaries SET
 training_session_count = (SELECT COUNT(*) FROM training_sessions t WHERE t.profile_id = daily_activity_summaries.profile_id AND t.local_date = daily_activity_summaries.date AND t.deleted_at IS NULL),
 training_completed_repetitions = COALESCE((SELECT SUM(completed_repetitions) FROM training_sessions t WHERE t.profile_id = daily_activity_summaries.profile_id AND t.local_date = daily_activity_summaries.date AND t.deleted_at IS NULL), 0);
CREATE TABLE training_preferences (
 profile_id TEXT PRIMARY KEY NOT NULL REFERENCES local_data_profiles(id) ON DELETE CASCADE,
 value_json TEXT NOT NULL, updated_at TEXT NOT NULL, sync_version INTEGER NOT NULL DEFAULT 0
);
PRAGMA user_version = 5;
`;

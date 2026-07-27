import { type SQLiteDatabase } from 'expo-sqlite';

const latestVersion = 7;

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS training_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          preset_id TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          completed_repetitions INTEGER NOT NULL,
          is_completed INTEGER NOT NULL,
          discomfort_reported INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_training_sessions_ended_at ON training_sessions (ended_at DESC);

        CREATE TABLE IF NOT EXISTS toilet_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          feeling TEXT NOT NULL,
          discomfort INTEGER NOT NULL DEFAULT 0,
          bleeding INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_toilet_sessions_ended_at ON toilet_sessions (ended_at DESC);

        CREATE TABLE IF NOT EXISTS habit_checkins (
          date TEXT PRIMARY KEY NOT NULL,
          water TEXT,
          fiber TEXT,
          movement TEXT,
          bowel TEXT,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reminder_settings (
          id TEXT PRIMARY KEY NOT NULL,
          kegel_enabled INTEGER NOT NULL DEFAULT 0,
          kegel_times TEXT NOT NULL,
          sedentary_enabled INTEGER NOT NULL DEFAULT 0,
          sedentary_interval_minutes INTEGER NOT NULL DEFAULT 60,
          quiet_hours_start TEXT NOT NULL,
          quiet_hours_end TEXT NOT NULL,
          privacy_mode INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL
        );
        PRAGMA user_version = 1;
      `);
    });
    version = 1;
  }

  if (version < 2) {
    await db.withTransactionAsync(async () => {
      await ensureColumn(db, 'reminder_settings', 'quiet_hours_ranges', 'TEXT');
      await db.execAsync('PRAGMA user_version = 2;');
    });
    version = 2;
  }

  if (version < 3) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        DROP INDEX IF EXISTS idx_training_sessions_ended_at;
        DROP INDEX IF EXISTS idx_toilet_sessions_ended_at;
        CREATE INDEX IF NOT EXISTS idx_training_sessions_ended_at_id
          ON training_sessions (ended_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_toilet_sessions_ended_at_id
          ON toilet_sessions (ended_at DESC, id DESC);
        PRAGMA user_version = 3;
      `);
    });
    version = 3;
  }

  if (version < 4) {
    await db.withTransactionAsync(async () => {
      await ensureColumn(db, 'toilet_sessions', 'stool_shape', 'TEXT');
      await ensureColumn(db, 'toilet_sessions', 'stool_color', 'TEXT');
      await ensureColumn(db, 'toilet_sessions', 'signals_json', "TEXT NOT NULL DEFAULT '[]'");
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS toilet_signal_presets (
          id TEXT PRIMARY KEY NOT NULL,
          label TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_toilet_signal_presets_label
          ON toilet_signal_presets (label COLLATE NOCASE);
        PRAGMA user_version = 4;
      `);
    });
    version = 4;
  }

  if (version < 5) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS local_data_profiles (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT UNIQUE,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT OR IGNORE INTO local_data_profiles (id, user_id, created_at, updated_at)
        VALUES ('local-default', NULL, datetime('now'), datetime('now'));

        CREATE TABLE IF NOT EXISTS app_metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('active_profile_id', 'local-default');

        CREATE TABLE IF NOT EXISTS daily_activity_summaries (
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
          PRIMARY KEY (profile_id, date),
          FOREIGN KEY (profile_id) REFERENCES local_data_profiles(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_daily_activity_summaries_profile_date
          ON daily_activity_summaries (profile_id, date DESC);

        CREATE TABLE IF NOT EXISTS data_sync_outbox (
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
        CREATE INDEX IF NOT EXISTS idx_data_sync_outbox_profile_sequence
          ON data_sync_outbox (profile_id, sequence);

        CREATE TABLE IF NOT EXISTS data_sync_state (
          profile_id TEXT PRIMARY KEY NOT NULL,
          cursor TEXT NOT NULL DEFAULT '0',
          last_synced_at TEXT,
          FOREIGN KEY (profile_id) REFERENCES local_data_profiles(id) ON DELETE CASCADE
        );
      `);

      await ensureColumn(db, 'training_sessions', 'profile_id', "TEXT NOT NULL DEFAULT 'local-default'");
      await ensureColumn(db, 'training_sessions', 'local_date', 'TEXT');
      await ensureColumn(db, 'training_sessions', 'updated_at', "TEXT NOT NULL DEFAULT ''");
      await ensureColumn(db, 'training_sessions', 'deleted_at', 'TEXT');
      await ensureColumn(db, 'training_sessions', 'sync_version', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumn(db, 'toilet_sessions', 'profile_id', "TEXT NOT NULL DEFAULT 'local-default'");
      await ensureColumn(db, 'toilet_sessions', 'local_date', 'TEXT');
      await ensureColumn(db, 'toilet_sessions', 'updated_at', "TEXT NOT NULL DEFAULT ''");
      await ensureColumn(db, 'toilet_sessions', 'deleted_at', 'TEXT');
      await ensureColumn(db, 'toilet_sessions', 'sync_version', 'INTEGER NOT NULL DEFAULT 0');
      await db.execAsync(`
        UPDATE training_sessions
        SET local_date = date(ended_at, 'localtime'), updated_at = CASE WHEN updated_at = '' THEN ended_at ELSE updated_at END
        WHERE local_date IS NULL;
        UPDATE toilet_sessions
        SET local_date = date(ended_at, 'localtime'), updated_at = CASE WHEN updated_at = '' THEN ended_at ELSE updated_at END
        WHERE local_date IS NULL;

        CREATE INDEX IF NOT EXISTS idx_training_sessions_profile_date
          ON training_sessions (profile_id, local_date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_toilet_sessions_profile_date
          ON toilet_sessions (profile_id, local_date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_training_sessions_profile_ended_at_id
          ON training_sessions (profile_id, ended_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_toilet_sessions_profile_ended_at_id
          ON toilet_sessions (profile_id, ended_at DESC, id DESC);
      `);

      const habitColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(habit_checkins);');
      if (habitColumns.length > 0 && !habitColumns.some((column) => column.name === 'profile_id')) {
        await db.execAsync(`
          ALTER TABLE habit_checkins RENAME TO habit_checkins_v4;
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
          INSERT INTO habit_checkins (profile_id, date, water, fiber, movement, bowel, updated_at)
          SELECT 'local-default', date, water, fiber, movement, bowel, updated_at FROM habit_checkins_v4;
          DROP TABLE habit_checkins_v4;
        `);
      } else if (habitColumns.length === 0) {
        await db.execAsync(`
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
            PRIMARY KEY (profile_id, date)
          );
        `);
      }
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_habit_checkins_profile_date ON habit_checkins (profile_id, date DESC);',
      );

      const presetColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(toilet_signal_presets);');
      if (presetColumns.length > 0 && !presetColumns.some((column) => column.name === 'profile_id')) {
        await db.execAsync(`
          ALTER TABLE toilet_signal_presets RENAME TO toilet_signal_presets_v4;
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
          INSERT INTO toilet_signal_presets (profile_id, id, label, created_at, updated_at)
          SELECT 'local-default', id, label, created_at, updated_at FROM toilet_signal_presets_v4;
          DROP TABLE toilet_signal_presets_v4;
        `);
      }
      await db.execAsync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_toilet_signal_presets_profile_label
          ON toilet_signal_presets (profile_id, label COLLATE NOCASE);
        PRAGMA user_version = 5;
      `);
    });
    version = 5;
  }

  if (version < 6) {
    await db.withTransactionAsync(async () => {
      await ensureColumn(db, 'daily_activity_summaries', 'toilet_max_duration_seconds', 'INTEGER NOT NULL DEFAULT 0');
      await db.execAsync('PRAGMA user_version = 6;');
    });
    version = 6;
  }

  if (version < 7) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS growth_event_outbox (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT NOT NULL UNIQUE,
          installation_id TEXT NOT NULL,
          event_name TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          platform TEXT NOT NULL,
          app_version TEXT NOT NULL,
          properties_json TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_growth_event_outbox_sequence
          ON growth_event_outbox (sequence);
        PRAGMA user_version = 7;
      `);
    });
    version = 7;
  }

  if (version !== latestVersion) throw new Error(`Unsupported database version: ${version}`);
}

async function ensureColumn(db: SQLiteDatabase, tableName: string, columnName: string, columnType: string) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
  if (!columns.some((column) => column.name === columnName)) {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType};`);
  }
}

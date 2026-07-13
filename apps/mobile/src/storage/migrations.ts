import { type SQLiteDatabase } from 'expo-sqlite';

const latestVersion = 3;

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

  if (version !== latestVersion) throw new Error(`Unsupported database version: ${version}`);
}

async function ensureColumn(db: SQLiteDatabase, tableName: string, columnName: string, columnType: string) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
  if (!columns.some((column) => column.name === columnName)) {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType};`);
  }
}

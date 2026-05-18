import { type SQLiteDatabase } from 'expo-sqlite';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

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

    CREATE INDEX IF NOT EXISTS idx_training_sessions_ended_at
      ON training_sessions (ended_at DESC);

    CREATE TABLE IF NOT EXISTS toilet_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      feeling TEXT NOT NULL,
      discomfort INTEGER NOT NULL DEFAULT 0,
      bleeding INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_toilet_sessions_ended_at
      ON toilet_sessions (ended_at DESC);

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
  `);
}

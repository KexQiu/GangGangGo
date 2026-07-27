import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, describe, expect, it } from 'vitest';

import { runMigrations } from '../migrations';
import { enqueueUnsyncedProfileData } from '../profileDataBootstrap';
import { mergeAnonymousProfile } from '../profileDataMerge';

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe('SQLite migrations', () => {
  it('upgrades an empty v0 database through every version', async () => {
    const harness = createDatabaseHarness();

    await runMigrations(harness.db);

    expect(getUserVersion(harness.database)).toBe(7);
    expect(getTableNames(harness.database)).toEqual([
      'app_metadata',
      'daily_activity_summaries',
      'data_sync_outbox',
      'data_sync_state',
      'growth_event_outbox',
      'habit_checkins',
      'local_data_profiles',
      'reminder_settings',
      'toilet_sessions',
      'toilet_signal_presets',
      'training_sessions',
    ]);
    expect(getColumnNames(harness.database, 'reminder_settings')).toContain('quiet_hours_ranges');
    expect(getColumnNames(harness.database, 'toilet_sessions')).toEqual(
      expect.arrayContaining(['deleted_at', 'local_date', 'profile_id', 'signals_json', 'stool_color', 'stool_shape']),
    );
    expect(getColumnNames(harness.database, 'habit_checkins')).toEqual(
      expect.arrayContaining(['deleted_at', 'profile_id', 'sync_version']),
    );
    expect(getColumnNames(harness.database, 'daily_activity_summaries')).toContain('toilet_max_duration_seconds');
    expect(getColumnNames(harness.database, 'growth_event_outbox')).toEqual(
      expect.arrayContaining(['event_id', 'installation_id', 'event_name', 'occurred_at', 'properties_json']),
    );
    expect(getIndexNames(harness.database)).toEqual(
      expect.arrayContaining(['idx_toilet_sessions_profile_ended_at_id', 'idx_training_sessions_profile_ended_at_id']),
    );
  });

  it('upgrades a populated v1 database without losing health records', async () => {
    const harness = createDatabaseHarness();
    seedVersionOneDatabase(harness.database);

    await runMigrations(harness.db);

    expect(getUserVersion(harness.database)).toBe(7);
    expect(getColumnNames(harness.database, 'reminder_settings')).toContain('quiet_hours_ranges');
    expect(getColumnNames(harness.database, 'toilet_sessions')).toEqual(
      expect.arrayContaining(['deleted_at', 'local_date', 'profile_id', 'signals_json', 'stool_color', 'stool_shape']),
    );
    expect(getIds(harness.database, 'training_sessions')).toEqual(['training-existing']);
    expect(getIds(harness.database, 'toilet_sessions')).toEqual(['toilet-existing']);
    expect(getProfileIds(harness.database, 'training_sessions')).toEqual(['local-default']);
    expect(getProfileIds(harness.database, 'toilet_sessions')).toEqual(['local-default']);
  });

  it('adds the maximum toilet duration to an existing v5 summary without losing it', async () => {
    const harness = createDatabaseHarness();
    harness.database.exec(`
      CREATE TABLE daily_activity_summaries (
        profile_id TEXT NOT NULL,
        date TEXT NOT NULL,
        toilet_median_duration_seconds INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (profile_id, date)
      );
      INSERT INTO daily_activity_summaries (profile_id, date, toilet_median_duration_seconds)
      VALUES ('local-default', '2026-07-21', 360);
      PRAGMA user_version = 5;
    `);

    await runMigrations(harness.db);

    expect(getUserVersion(harness.database)).toBe(7);
    expect(getColumnNames(harness.database, 'daily_activity_summaries')).toContain('toilet_max_duration_seconds');
    expect(
      harness.database
        .prepare("SELECT toilet_median_duration_seconds FROM daily_activity_summaries WHERE date = '2026-07-21'")
        .get()?.toilet_median_duration_seconds,
    ).toBe(360);
  });

  it('rolls back a failed migration and preserves its previous version and data', async () => {
    const harness = createDatabaseHarness(/ALTER TABLE reminder_settings/);
    seedVersionOneDatabase(harness.database);

    await expect(runMigrations(harness.db)).rejects.toThrow('Injected migration failure');

    expect(getUserVersion(harness.database)).toBe(1);
    expect(getColumnNames(harness.database, 'reminder_settings')).not.toContain('quiet_hours_ranges');
    expect(getIds(harness.database, 'training_sessions')).toEqual(['training-existing']);
    expect(getIds(harness.database, 'toilet_sessions')).toEqual(['toilet-existing']);
  });

  it('queues existing profile records once for the first account sync', async () => {
    const harness = createDatabaseHarness();
    await runMigrations(harness.db);
    harness.database.exec(`
      INSERT INTO training_sessions (
        id, preset_id, started_at, ended_at, duration_seconds, completed_repetitions,
        is_completed, discomfort_reported, local_date, updated_at
      ) VALUES (
        'training-bootstrap', 'standard', '2026-07-21T08:00:00.000Z', '2026-07-21T08:02:00.000Z',
        120, 12, 1, 0, date('now', 'localtime'), '2026-07-21T08:02:00.000Z'
      );
      INSERT INTO habit_checkins (date, water, fiber, movement, bowel, updated_at)
      VALUES (date('now', 'localtime'), 'good', 'medium', 'low', 'good', '2026-07-21T09:00:00.000Z');
      INSERT INTO toilet_sessions (
        id, started_at, ended_at, duration_seconds, feeling, discomfort, bleeding,
        stool_shape, stool_color, signals_json, local_date, updated_at
      ) VALUES (
        'toilet-bootstrap', '2026-07-21T10:00:00.000Z', '2026-07-21T10:06:00.000Z', 360,
        'normal', 0, 0, 'formed', 'normal', '[{"id":"signal-1","label":"腹胀"}]',
        date('now', 'localtime'), '2026-07-21T10:06:00.000Z'
      );
      INSERT INTO toilet_signal_presets (id, label, created_at, updated_at)
      VALUES ('signal-preset', '腹胀', '2026-07-21T10:00:00.000Z', '2026-07-21T10:00:00.000Z');
    `);

    await enqueueUnsyncedProfileData(harness.db, 'local-default');
    await enqueueUnsyncedProfileData(harness.db, 'local-default');

    const rows = harness.database
      .prepare('SELECT entity_type, payload_json FROM data_sync_outbox ORDER BY entity_type')
      .all();
    expect(rows).toHaveLength(4);
    expect(JSON.parse(String(rows.find((row) => row.entity_type === 'training_session')?.payload_json))).toMatchObject({
      discomfortReported: false,
      isCompleted: true,
    });
    expect(JSON.parse(String(rows.find((row) => row.entity_type === 'toilet_session')?.payload_json))).toMatchObject({
      signals: [{ id: 'signal-1', label: '腹胀' }],
    });
  });

  it('merges anonymous records into an existing account profile without crossing profiles', async () => {
    const harness = createDatabaseHarness();
    await runMigrations(harness.db);
    harness.database.exec(`
      INSERT INTO local_data_profiles (id, user_id, created_at, updated_at)
      VALUES ('profile-account', 'user-account', '2026-07-20T00:00:00.000Z', '2026-07-20T00:00:00.000Z');
      INSERT INTO habit_checkins (profile_id, date, water, updated_at)
      VALUES ('profile-account', '2026-07-21', 'low', '2026-07-21T08:00:00.000Z');
      INSERT INTO habit_checkins (profile_id, date, water, updated_at)
      VALUES ('local-default', '2026-07-21', 'good', '2026-07-21T09:00:00.000Z');
      INSERT INTO data_sync_outbox (
        mutation_id, profile_id, entity_type, entity_id, operation, payload_json, changed_at
      ) VALUES (
        'anonymous-mutation', 'local-default', 'habit_checkin', '2026-07-21', 'upsert',
        '{"date":"2026-07-21"}', '2026-07-21T09:00:00.000Z'
      );
    `);

    await mergeAnonymousProfile(harness.db, 'local-default', 'profile-account');

    expect(
      harness.database
        .prepare("SELECT water FROM habit_checkins WHERE profile_id = 'profile-account' AND date = '2026-07-21'")
        .get()?.water,
    ).toBe('good');
    expect(
      harness.database.prepare("SELECT profile_id FROM data_sync_outbox WHERE mutation_id = 'anonymous-mutation'").get()
        ?.profile_id,
    ).toBe('profile-account');
    expect(
      harness.database.prepare("SELECT id FROM local_data_profiles WHERE id = 'local-default'").get(),
    ).toBeUndefined();
  });
});

function createDatabaseHarness(failAfterPattern?: RegExp) {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  let pendingFailure = failAfterPattern;
  const db = {
    execAsync: async (sql: string) => {
      database.exec(sql);
      if (pendingFailure?.test(sql)) {
        pendingFailure = undefined;
        throw new Error('Injected migration failure');
      }
    },
    getAllAsync: async <T>(sql: string) => database.prepare(sql).all() as T[],
    getFirstAsync: async <T>(sql: string) => (database.prepare(sql).get() as T | undefined) ?? null,
    runAsync: async (sql: string, parameters: Record<string, string | number | null> = {}) =>
      database.prepare(sql).run(parameters),
    withTransactionAsync: async (operation: () => Promise<void>) => {
      database.exec('BEGIN');
      try {
        await operation();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;

  return { database, db };
}

function seedVersionOneDatabase(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE training_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      ended_at TEXT NOT NULL
    );
    CREATE INDEX idx_training_sessions_ended_at ON training_sessions (ended_at DESC);
    CREATE TABLE toilet_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      ended_at TEXT NOT NULL
    );
    CREATE INDEX idx_toilet_sessions_ended_at ON toilet_sessions (ended_at DESC);
    CREATE TABLE reminder_settings (
      id TEXT PRIMARY KEY NOT NULL
    );
    INSERT INTO training_sessions (id, ended_at) VALUES ('training-existing', '2026-07-13T08:00:00.000Z');
    INSERT INTO toilet_sessions (id, ended_at) VALUES ('toilet-existing', '2026-07-13T08:00:00.000Z');
    PRAGMA user_version = 1;
  `);
}

function getUserVersion(database: DatabaseSync): number {
  return Number(database.prepare('PRAGMA user_version').get()?.user_version ?? 0);
}

function getTableNames(database: DatabaseSync): string[] {
  return database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => String(row.name));
}

function getIndexNames(database: DatabaseSync): string[] {
  return database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => String(row.name));
}

function getColumnNames(database: DatabaseSync, tableName: string): string[] {
  return database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((row) => String(row.name));
}

function getIds(database: DatabaseSync, tableName: string): string[] {
  return database
    .prepare(`SELECT id FROM ${tableName} ORDER BY id`)
    .all()
    .map((row) => String(row.id));
}

function getProfileIds(database: DatabaseSync, tableName: string): string[] {
  return database
    .prepare(`SELECT profile_id FROM ${tableName} ORDER BY profile_id`)
    .all()
    .map((row) => String(row.profile_id));
}

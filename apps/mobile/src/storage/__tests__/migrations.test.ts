import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runMigrations } from '../migrations';
import { enqueueUnsyncedProfileData } from '../profileDataBootstrap';
import { mergeAnonymousProfile } from '../profileDataMerge';

vi.mock('../db', () => ({ initializeDatabase: vi.fn() }));
const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe('SQLite migrations', () => {
  it('initializes the current schema from an empty database', async () => {
    const harness = createDatabaseHarness();

    await runMigrations(harness.db);

    expect(getUserVersion(harness.database)).toBe(5);
    expect(getTableNames(harness.database)).toEqual([
      'app_metadata',
      'daily_activity_summaries',
      'data_sync_outbox',
      'data_sync_state',
      'growth_event_outbox',
      'habit_checkins',
      'local_data_profiles',
      'reminder_settings',
      'toilet_record_drafts',
      'toilet_sessions',
      'toilet_signal_presets',
      'training_preferences',
      'training_sessions',
      'watch_event_receipts',
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

  it('keeps initialized records and the schema unchanged on repeat initialization', async () => {
    const harness = createDatabaseHarness();
    await runMigrations(harness.db);
    harness.database.exec(`
      INSERT INTO reminder_settings (id, kegel_times, quiet_hours_ranges, updated_at)
      VALUES ('default', '["09:30"]', '[]', '2026-09-28T00:00:00Z');
    `);
    const schema = harness.database.prepare('SELECT sql FROM sqlite_master ORDER BY name').all();

    await runMigrations(harness.db);

    expect(getUserVersion(harness.database)).toBe(5);
    expect(getIds(harness.database, 'reminder_settings')).toEqual(['default']);
    expect(harness.database.prepare('SELECT sql FROM sqlite_master ORDER BY name').all()).toEqual(schema);
    expect(getColumnNames(harness.database, 'reminder_settings')).not.toContain('quiet_hours_start');
    expect(getColumnNames(harness.database, 'reminder_settings')).not.toContain('quiet_hours_end');
  });

  it('rolls back a failed initialization and can retry from an empty database', async () => {
    const harness = createDatabaseHarness(/CREATE TABLE reminder_settings/);
    await expect(runMigrations(harness.db)).rejects.toThrow('Injected migration failure');
    expect(getUserVersion(harness.database)).toBe(0);
    expect(getTableNames(harness.database)).toEqual([]);

    await runMigrations(harness.db);
    expect(getUserVersion(harness.database)).toBe(5);
    expect(getTableNames(harness.database)).toContain('reminder_settings');
  });

  it('rejects unsupported versions without changing existing data', async () => {
    const harness = createDatabaseHarness();
    harness.database.exec('CREATE TABLE sentinel (id TEXT); PRAGMA user_version = 99;');
    await expect(runMigrations(harness.db)).rejects.toThrow('Unsupported database version: 99');
    expect(getTableNames(harness.database)).toEqual(['sentinel']);
    expect(getUserVersion(harness.database)).toBe(99);
  });

  it('adds Watch receipts to version 1 without losing existing records', async () => {
    const harness = createDatabaseHarness();
    await runMigrations(harness.db);
    downgradeTrainingSchema(harness.database);
    harness.database
      .exec(`ALTER TABLE data_sync_state DROP COLUMN last_completed_at; DROP TABLE toilet_record_drafts; DROP TABLE watch_event_receipts; PRAGMA user_version = 1;
      INSERT INTO habit_checkins (date, water, updated_at) VALUES ('2026-09-28', 'good', '2026-09-28T00:00:00Z');`);
    await runMigrations(harness.db);
    expect(getUserVersion(harness.database)).toBe(5);
    expect(harness.database.prepare('SELECT water FROM habit_checkins').get()?.water).toBe('good');
    expect(getTableNames(harness.database)).toContain('watch_event_receipts');
  });

  it('adds drafts to version 2 without replacing existing health records', async () => {
    const harness = createDatabaseHarness();
    await runMigrations(harness.db);
    downgradeTrainingSchema(harness.database);
    harness.database
      .exec(`ALTER TABLE data_sync_state DROP COLUMN last_completed_at; DROP TABLE toilet_record_drafts; PRAGMA user_version = 2;
      INSERT INTO habit_checkins (date, water, updated_at) VALUES ('2026-09-28', 'good', '2026-09-28T00:00:00Z');`);
    await runMigrations(harness.db);
    expect(getUserVersion(harness.database)).toBe(5);
    expect(harness.database.prepare('SELECT water FROM habit_checkins').get()?.water).toBe('good');
    expect(getTableNames(harness.database)).toContain('toilet_record_drafts');
  });

  it('queues existing profile records once for the first account sync', async () => {
    const harness = createDatabaseHarness();
    await runMigrations(harness.db);
    harness.database.exec(`
      INSERT INTO training_sessions (
        id, preset_id, started_at, ended_at, duration_seconds, completed_repetitions,
        is_completed, feedback, end_reason, plan_json, local_date, updated_at
      ) VALUES (
        'training-bootstrap', 'standard', '2026-07-21T08:00:00.000Z', '2026-07-21T08:02:00.000Z',
        120, 12, 1, 'unanswered', 'completed', '{"contractSeconds":5,"relaxSeconds":5,"repetitions":12}', date('now', 'localtime'), '2026-07-21T08:02:00.000Z'
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
      feedback: 'unanswered' as const,
      endReason: 'completed' as const,
      plan: { contractSeconds: 5, relaxSeconds: 5, repetitions: 12 },
      isCompleted: true,
    });
    expect(JSON.parse(String(rows.find((row) => row.entity_type === 'toilet_session')?.payload_json))).toMatchObject({
      signals: [{ id: 'signal-1', label: '腹胀' }],
    });
  });

  it('adds a separate completion timestamp to version 3 without treating an old pull as success', async () => {
    const harness = createDatabaseHarness();
    await runMigrations(harness.db);
    downgradeTrainingSchema(harness.database);
    harness.database.exec(`ALTER TABLE data_sync_state DROP COLUMN last_completed_at; PRAGMA user_version = 3;
      INSERT INTO data_sync_state (profile_id, cursor, last_synced_at) VALUES ('local-default', '9', '2026-09-28T00:00:00Z');`);
    await runMigrations(harness.db);
    expect(getUserVersion(harness.database)).toBe(5);
    expect(harness.database.prepare('SELECT * FROM data_sync_state').get()).toMatchObject({
      cursor: '9',
      last_synced_at: '2026-09-28T00:00:00Z',
      last_completed_at: null,
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
    getFirstAsync: async <T>(sql: string, parameters: Record<string, string | number | null> = {}) =>
      (database.prepare(sql).get(parameters) as T | undefined) ?? null,
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

function downgradeTrainingSchema(database: DatabaseSync) {
  database.exec(`ALTER TABLE training_sessions DROP COLUMN feedback;
    ALTER TABLE training_sessions DROP COLUMN end_reason;
    ALTER TABLE training_sessions DROP COLUMN plan_json;
    ALTER TABLE training_sessions ADD COLUMN discomfort_reported INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE daily_activity_summaries DROP COLUMN training_session_count;
    DROP TABLE training_preferences; PRAGMA user_version = 4;`);
}

it('migrates feedback, only certain Watch counts, and pending payloads without losing records', async () => {
  const harness = createDatabaseHarness();
  await runMigrations(harness.db);
  downgradeTrainingSchema(harness.database);
  harness.database
    .exec(`INSERT INTO training_sessions (id,preset_id,started_at,ended_at,duration_seconds,completed_repetitions,is_completed,discomfort_reported)
    VALUES ('watch-full','standard','2026-09-28T00:00:00Z','2026-09-28T00:02:00Z',120,1,1,0),
    ('watch-uncertain','standard','2026-09-28T00:00:00Z','2026-09-28T00:01:00Z',60,1,1,0),
    ('phone-partial','beginner','2026-09-28T00:00:00Z','2026-09-28T00:00:06Z',6,1,0,1);
    INSERT INTO data_sync_outbox (mutation_id,profile_id,entity_type,entity_id,operation,payload_json,changed_at)
    VALUES ('old','local-default','training_session','watch-full','upsert','{"presetId":"standard","durationSeconds":120,"completedRepetitions":1,"isCompleted":true,"discomfortReported":false}','2026-09-28');`);
  await runMigrations(harness.db);
  expect(
    harness.database.prepare('SELECT id,completed_repetitions,feedback FROM training_sessions ORDER BY id').all(),
  ).toMatchObject([
    { id: 'phone-partial', completed_repetitions: 1, feedback: 'reported' },
    { id: 'watch-full', completed_repetitions: 12, feedback: 'unanswered' },
    { id: 'watch-uncertain', completed_repetitions: 1, feedback: 'unanswered' },
  ]);
  const payload = JSON.parse(
    String(harness.database.prepare('SELECT payload_json FROM data_sync_outbox').get()?.payload_json),
  );
  expect(payload).toMatchObject({ completedRepetitions: 12, feedback: 'unanswered', plan: { repetitions: 12 } });
  expect(payload).not.toHaveProperty('discomfortReported');
});

it.each([true, false])(
  'merges only the selected training configuration and never uploads superseded settings (%s)',
  async (sourceNewer) => {
    const { database, db } = createDatabaseHarness();
    await runMigrations(db);
    const older = '2026-09-28';
    const newer = '2026-09-29';
    database.exec(`INSERT INTO local_data_profiles (id,user_id,created_at,updated_at) VALUES ('account','A','${older}','${older}');
    INSERT INTO training_preferences VALUES ('local-default','{"dailyTarget":1}','${sourceNewer ? newer : older}',0),('account','{"dailyTarget":2}','${sourceNewer ? older : newer}',0);
    INSERT INTO data_sync_outbox (mutation_id,profile_id,entity_type,entity_id,operation,payload_json,changed_at)
      VALUES ('source','local-default','training_preferences','preferences','upsert','{"dailyTarget":1}','${older}'),('target','account','training_preferences','preferences','upsert','{"dailyTarget":2}','${older}');`);
    await mergeAnonymousProfile(db, 'local-default', 'account');
    const expected = { dailyTarget: sourceNewer ? 1 : 2 };
    expect(
      JSON.parse(String(database.prepare('SELECT value_json FROM training_preferences').get()?.value_json)),
    ).toEqual(expected);
    const outbox = database.prepare('SELECT profile_id,payload_json FROM data_sync_outbox').all();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.profile_id).toBe('account');
    expect(JSON.parse(String(outbox[0]?.payload_json))).toEqual(expected);
  },
);

it('migrates processed Watch receipt versions without changing identity or normalized payload', async () => {
  const { database, db } = createDatabaseHarness();
  await runMigrations(db);
  downgradeTrainingSchema(database);
  const event = {
    id: 'habit-1',
    createdAt: '2026-09-29T00:00:00Z',
    schemaVersion: 3,
    owner: { userId: 'A', profileId: 'local-default' },
    type: 'habit_toggled',
    payload: { habitKey: 'water', level: null },
  };
  database
    .prepare("INSERT INTO watch_event_receipts VALUES ('local-default','habit-1',?,'2026-09-29')")
    .run(JSON.stringify(event));
  await runMigrations(db);
  expect(database.prepare('SELECT event_json FROM watch_event_receipts').get()?.event_json).toBe(
    JSON.stringify({ ...event, schemaVersion: 4 }),
  );
});

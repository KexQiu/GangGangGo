import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, describe, expect, it } from 'vitest';

import { runMigrations } from '../migrations';

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe('SQLite migrations', () => {
  it('upgrades an empty v0 database through every version', async () => {
    const harness = createDatabaseHarness();

    await runMigrations(harness.db);

    expect(getUserVersion(harness.database)).toBe(3);
    expect(getTableNames(harness.database)).toEqual([
      'habit_checkins',
      'reminder_settings',
      'toilet_sessions',
      'training_sessions',
    ]);
    expect(getColumnNames(harness.database, 'reminder_settings')).toContain('quiet_hours_ranges');
    expect(getIndexNames(harness.database)).toEqual(
      expect.arrayContaining(['idx_toilet_sessions_ended_at_id', 'idx_training_sessions_ended_at_id']),
    );
  });

  it('upgrades a populated v1 database without losing health records', async () => {
    const harness = createDatabaseHarness();
    seedVersionOneDatabase(harness.database);

    await runMigrations(harness.db);

    expect(getUserVersion(harness.database)).toBe(3);
    expect(getColumnNames(harness.database, 'reminder_settings')).toContain('quiet_hours_ranges');
    expect(getIds(harness.database, 'training_sessions')).toEqual(['training-existing']);
    expect(getIds(harness.database, 'toilet_sessions')).toEqual(['toilet-existing']);
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

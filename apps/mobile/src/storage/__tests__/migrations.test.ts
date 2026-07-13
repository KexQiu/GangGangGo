import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it, vi } from 'vitest';

import { runMigrations } from '../migrations';

describe('SQLite migrations', () => {
  it('upgrades an empty legacy database through every version', async () => {
    const harness = createDatabaseHarness(0);

    await runMigrations(harness.db);

    const sql = harness.execAsync.mock.calls.flat().join('\n');
    expect(harness.withTransactionAsync).toHaveBeenCalledTimes(3);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS training_sessions');
    expect(sql).toContain('ALTER TABLE reminder_settings ADD COLUMN quiet_hours_ranges TEXT');
    expect(sql).toContain('idx_training_sessions_ended_at_id');
    expect(sql).toContain('idx_toilet_sessions_ended_at_id');
    expect(sql).toContain('PRAGMA user_version = 3');
  });

  it('upgrades v2 by changing indexes without recreating health tables', async () => {
    const harness = createDatabaseHarness(2);

    await runMigrations(harness.db);

    const sql = harness.execAsync.mock.calls.flat().join('\n');
    expect(harness.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(sql).not.toContain('CREATE TABLE');
    expect(sql).toContain('DROP INDEX IF EXISTS idx_training_sessions_ended_at');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_training_sessions_ended_at_id');
    expect(sql).toContain('PRAGMA user_version = 3');
  });
});

function createDatabaseHarness(version: number) {
  const execAsync = vi.fn(async () => undefined);
  const getAllAsync = vi.fn(async () => []);
  const getFirstAsync = vi.fn(async () => ({ user_version: version }));
  const withTransactionAsync = vi.fn(async (operation: () => Promise<void>) => operation());
  const db = {
    execAsync,
    getAllAsync,
    getFirstAsync,
    withTransactionAsync,
  } as unknown as SQLiteDatabase;

  return { db, execAsync, getAllAsync, getFirstAsync, withTransactionAsync };
}

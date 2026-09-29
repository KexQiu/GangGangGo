import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authSessionContext } from '../../../api/sessionContext';
import { runMigrations } from '../../../storage/migrations';
import { listHabitCheckInsPage, saveHabitLevel } from '../../../storage/repositories/habitRepository';
import { getDailyDataDetails } from '../../data/dailyData';
import { calculateHabitCompletion, calculateHabitStreak } from '../habitLogic';
import { getHabitLevelStandard } from '../habitStandards';

const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock('../../../storage/db', () => ({ initializeDatabase: mocks.db }));

let database: DatabaseSync;
const date = '2026-09-29';

beforeEach(async () => {
  const generation = authSessionContext.beginTransition();
  database = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async (sql: string) => database.exec(sql),
    runAsync: async (sql: string, params: Record<string, SQLInputValue> = {}) => database.prepare(sql).run(params),
    getFirstAsync: async (sql: string, params: Record<string, SQLInputValue> = {}) =>
      database.prepare(sql).get(params) ?? null,
    getAllAsync: async (sql: string, params: Record<string, SQLInputValue> = {}) => database.prepare(sql).all(params),
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
  mocks.db.mockResolvedValue(adapter);
  await runMigrations(adapter);
  authSessionContext.completeAnonymousTransition(generation);
});
afterEach(() => database.close());

describe('habit recording with no bowel movement', () => {
  it('preserves the state through SQLite reload, editing another field, upload payload and daily details', async () => {
    await saveHabitLevel(date, 'bowel', 'not_today');
    await saveHabitLevel(date, 'water', 'low');
    await saveHabitLevel(date, 'fiber', 'medium');
    await saveHabitLevel(date, 'movement', 'good');

    const checkIn = (await listHabitCheckInsPage()).items[0]!;
    expect(checkIn).toMatchObject({ bowel: 'not_today', water: 'low', fiber: 'medium', movement: 'good' });
    expect(calculateHabitCompletion(checkIn)).toBe(4);
    expect(calculateHabitStreak([checkIn], new Date(2026, 8, 29, 12))).toBe(1);
    expect((await getDailyDataDetails(date)).summary.habit).toMatchObject({ bowel: 'not_today', completionCount: 4 });
    const uploads = database
      .prepare("SELECT payload_json FROM data_sync_outbox WHERE entity_type = 'habit_checkin'")
      .all();
    expect(uploads.length).toBeGreaterThan(0);
    for (const upload of uploads) expect(JSON.parse(String(upload.payload_json)).bowel).toBe('not_today');
    expect(getHabitLevelStandard('bowel', checkIn.bowel!).label).toBe('今日未排便');
  });

  it('can replace and clear the state without losing the other habit records', async () => {
    await saveHabitLevel(date, 'bowel', 'not_today');
    await saveHabitLevel(date, 'water', 'low');
    await saveHabitLevel(date, 'bowel', 'low');
    expect((await getDailyDataDetails(date)).summary.habit).toMatchObject({ bowel: 'low', completionCount: 2 });
    await saveHabitLevel(date, 'bowel', null);
    expect((await listHabitCheckInsPage()).items[0]).toMatchObject({ bowel: null, water: 'low' });
    expect((await getDailyDataDetails(date)).summary.habit.completionCount).toBe(1);
  });

  it('rejects the bowel-only state on the other categories before writing', async () => {
    for (const key of ['water', 'fiber', 'movement'] as const) {
      await expect(saveHabitLevel(date, key, 'not_today')).rejects.toThrow('仅适用于排便记录');
    }
    expect((await listHabitCheckInsPage()).items).toEqual([]);
  });
});

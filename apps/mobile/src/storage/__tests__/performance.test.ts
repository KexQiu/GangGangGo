import { performance } from 'node:perf_hooks';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getLocalDateKey } from '../../features/habits/habitLogic';
import type { HabitCheckIn } from '../../features/habits/habitTypes';
import { buildRecentReportSnapshots } from '../../features/reports/reportSnapshotBuilder';
import type { ToiletSession } from '../../features/toilet/toiletTypes';
import type { TrainingSession } from '../../features/training/trainingTypes';
import { buildLocalDateRange } from '../dateRange';
import { runMigrations } from '../migrations';
import { habitCheckInPageSql, toiletSessionPageSql, trainingSessionPageSql } from '../repositories/pageQueries';

const historyDays = 3650;
const maximumBenchmarkDurationMs = 1000;
const now = new Date(2026, 6, 13, 12, 0, 0);

type QueryParameters = Record<string, SQLInputValue>;
type HabitRow = {
  bowel: string | null;
  date: string;
  fiber: string | null;
  movement: string | null;
  updated_at: string;
  water: string | null;
};
type ToiletRow = {
  bleeding: number;
  discomfort: number;
  duration_seconds: number;
  ended_at: string;
  feeling: string;
  id: string;
  started_at: string;
};
type TrainingRow = {
  completed_repetitions: number;
  discomfort_reported: number;
  duration_seconds: number;
  ended_at: string;
  id: string;
  is_completed: number;
  preset_id: string;
  started_at: string;
};

let database: DatabaseSync;

beforeEach(async () => {
  database = new DatabaseSync(':memory:');
  await runMigrations(createExpoDatabaseAdapter(database));
  seedHistory(database);
});

afterEach(() => database.close());

describe('SQLite large-history performance', () => {
  it('keeps 30-day startup hydration bounded and index-backed', () => {
    const range = buildLocalDateRange(30, now);
    const habitParams = habitParameters(range.fromDate, range.toDateExclusive, 31);
    const sessionParams = sessionParameters(range.fromDateTime, range.toDateTimeExclusive, 251);

    const { durationMs, value } = measure(() => ({
      habits: queryAll<HabitRow>(database, habitCheckInPageSql, habitParams),
      toilets: queryAll<ToiletRow>(database, toiletSessionPageSql, sessionParams),
      trainings: queryAll<TrainingRow>(database, trainingSessionPageSql, sessionParams),
    }));

    expect(value.habits).toHaveLength(30);
    expect(value.toilets).toHaveLength(30);
    expect(value.trainings).toHaveLength(60);
    expect(durationMs).toBeLessThan(maximumBenchmarkDurationMs);
    expect(queryPlan(database, habitCheckInPageSql, habitParams)).toContain('sqlite_autoindex_habit_checkins_1');
    expect(queryPlan(database, toiletSessionPageSql, sessionParams)).toContain('idx_toilet_sessions_ended_at_id');
    expect(queryPlan(database, trainingSessionPageSql, sessionParams)).toContain('idx_training_sessions_ended_at_id');
  });

  it('pages a large training history with a stable composite cursor', () => {
    const firstParams = sessionParameters(null, null, 101);
    const firstPage = queryAll<TrainingRow>(database, trainingSessionPageSql, firstParams).slice(0, 100);
    const lastFirstRow = firstPage.at(-1);
    expect(lastFirstRow).toBeDefined();

    const secondParams = sessionParameters(null, null, 101, lastFirstRow?.ended_at, lastFirstRow?.id);
    const { durationMs, value: secondPage } = measure(() =>
      queryAll<TrainingRow>(database, trainingSessionPageSql, secondParams).slice(0, 100),
    );

    expect(firstPage).toHaveLength(100);
    expect(secondPage).toHaveLength(100);
    expect(new Set([...firstPage, ...secondPage].map((row) => row.id))).toHaveLength(200);
    expect(secondPage[0]?.ended_at <= (lastFirstRow?.ended_at ?? '')).toBe(true);
    expect(durationMs).toBeLessThan(maximumBenchmarkDurationMs);
    expect(queryPlan(database, trainingSessionPageSql, secondParams)).toContain('idx_training_sessions_ended_at_id');
  });

  it('loads and builds a 90-day report with three bounded queries', () => {
    const range = buildLocalDateRange(90, now);
    let queryCount = 0;
    const runQuery = <T>(sql: string, parameters: QueryParameters) => {
      queryCount += 1;
      return queryAll<T>(database, sql, parameters);
    };

    const { durationMs, value: snapshots } = measure(() => {
      const habits = runQuery<HabitRow>(
        habitCheckInPageSql,
        habitParameters(range.fromDate, range.toDateExclusive, 91),
      ).map(rowToHabitCheckIn);
      const toilets = runQuery<ToiletRow>(
        toiletSessionPageSql,
        sessionParameters(range.fromDateTime, range.toDateTimeExclusive, 251),
      ).map(rowToToiletSession);
      const trainings = runQuery<TrainingRow>(
        trainingSessionPageSql,
        sessionParameters(range.fromDateTime, range.toDateTimeExclusive, 251),
      ).map(rowToTrainingSession);
      return buildRecentReportSnapshots(
        { habitCheckIns: habits, toiletSessions: toilets, trainingSessions: trainings },
        now,
      );
    });

    expect(queryCount).toBe(3);
    expect(snapshots).toHaveLength(90);
    expect(snapshots.at(-1)?.date).toBe(getLocalDateKey(now));
    expect(snapshots.every((snapshot) => snapshot.trainingDone && snapshot.toiletRecorded)).toBe(true);
    expect(durationMs).toBeLessThan(maximumBenchmarkDurationMs);
  });
});

function createExpoDatabaseAdapter(source: DatabaseSync) {
  return {
    execAsync: async (sql: string) => source.exec(sql),
    getAllAsync: async <T>(sql: string) => source.prepare(sql).all() as T[],
    getFirstAsync: async <T>(sql: string) => (source.prepare(sql).get() as T | undefined) ?? null,
    withTransactionAsync: async (operation: () => Promise<void>) => {
      source.exec('BEGIN');
      try {
        await operation();
        source.exec('COMMIT');
      } catch (error) {
        source.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;
}

function seedHistory(source: DatabaseSync) {
  const insertHabit = source.prepare(`
    INSERT INTO habit_checkins (date, water, fiber, movement, bowel, updated_at)
    VALUES (?, 'good', 'good', 'good', 'good', ?)
  `);
  const insertToilet = source.prepare(`
    INSERT INTO toilet_sessions
      (id, started_at, ended_at, duration_seconds, feeling, discomfort, bleeding)
    VALUES (?, ?, ?, 420, 'normal', 0, 0)
  `);
  const insertTraining = source.prepare(`
    INSERT INTO training_sessions
      (id, preset_id, started_at, ended_at, duration_seconds, completed_repetitions, is_completed, discomfort_reported)
    VALUES (?, 'standard', ?, ?, 120, 12, 1, 0)
  `);

  source.exec('BEGIN');
  try {
    for (let dayIndex = 0; dayIndex < historyDays; dayIndex += 1) {
      const day = new Date(now);
      day.setDate(now.getDate() - dayIndex);
      const dateKey = getLocalDateKey(day);
      const toiletStartedAt = atLocalTime(day, 8, 0);
      const toiletEndedAt = atLocalTime(day, 8, 7);
      insertHabit.run(dateKey, toiletEndedAt);
      insertToilet.run(`toilet-${dayIndex}`, toiletStartedAt, toiletEndedAt);

      for (let sessionIndex = 0; sessionIndex < 2; sessionIndex += 1) {
        const startedAt = atLocalTime(day, 18, sessionIndex * 10);
        const endedAt = atLocalTime(day, 18, sessionIndex * 10 + 2);
        insertTraining.run(`training-${dayIndex}-${sessionIndex}`, startedAt, endedAt);
      }
    }
    source.exec('COMMIT');
  } catch (error) {
    source.exec('ROLLBACK');
    throw error;
  }
}

function atLocalTime(date: Date, hours: number, minutes: number) {
  const value = new Date(date);
  value.setHours(hours, minutes, 0, 0);
  return value.toISOString();
}

function habitParameters(fromDate: string | null, toDateExclusive: string | null, queryLimit: number) {
  return { $cursorDate: null, $fromDate: fromDate, $queryLimit: queryLimit, $toDateExclusive: toDateExclusive };
}

function sessionParameters(
  fromDateTime: string | null,
  toDateTimeExclusive: string | null,
  queryLimit: number,
  cursorEndedAt: string | null = null,
  cursorId: string | null = null,
) {
  return {
    $cursorEndedAt: cursorEndedAt,
    $cursorId: cursorId,
    $fromDateTime: fromDateTime,
    $queryLimit: queryLimit,
    $toDateTimeExclusive: toDateTimeExclusive,
  };
}

function queryAll<T>(source: DatabaseSync, sql: string, parameters: QueryParameters) {
  return source.prepare(sql).all(parameters) as T[];
}

function queryPlan(source: DatabaseSync, sql: string, parameters: QueryParameters) {
  return source
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(parameters)
    .map((row) => String(row.detail))
    .join(' ');
}

function measure<T>(operation: () => T) {
  const startedAt = performance.now();
  const value = operation();
  return { durationMs: performance.now() - startedAt, value };
}

function rowToHabitCheckIn(row: HabitRow): HabitCheckIn {
  return {
    bowel: 'good',
    date: row.date,
    fiber: 'good',
    movement: 'good',
    updatedAt: row.updated_at,
    water: 'good',
  };
}

function rowToToiletSession(row: ToiletRow): ToiletSession {
  return {
    bleeding: Boolean(row.bleeding),
    discomfort: Boolean(row.discomfort),
    durationSeconds: row.duration_seconds,
    endedAt: row.ended_at,
    feeling: 'normal',
    id: row.id,
    startedAt: row.started_at,
  };
}

function rowToTrainingSession(row: TrainingRow): TrainingSession {
  return {
    completedRepetitions: row.completed_repetitions,
    discomfortReported: Boolean(row.discomfort_reported),
    durationSeconds: row.duration_seconds,
    endedAt: row.ended_at,
    id: row.id,
    isCompleted: Boolean(row.is_completed),
    presetId: 'standard',
    startedAt: row.started_at,
  };
}

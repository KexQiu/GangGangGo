import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';

import type { DailyReportSnapshot } from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import { dailyReportSnapshots } from '../../db/schema.js';
import { toDailyReportSnapshot } from './report.mapper.js';

export type ReportRepository = {
  listDailyReportSnapshots: (userId: string, startedAt: string, endedAt: string) => Promise<DailyReportSnapshot[]>;
  upsertDailyReportSnapshot: (userId: string, snapshot: DailyReportSnapshot) => Promise<DailyReportSnapshot>;
  upsertDailyReportSnapshots: (userId: string, snapshots: DailyReportSnapshot[]) => Promise<DailyReportSnapshot[]>;
};

export function createDrizzleReportRepository(db: Database): ReportRepository {
  return {
    async listDailyReportSnapshots(userId, startedAt, endedAt) {
      const records = await db
        .select()
        .from(dailyReportSnapshots)
        .where(
          and(
            eq(dailyReportSnapshots.userId, userId),
            gte(dailyReportSnapshots.date, startedAt),
            lte(dailyReportSnapshots.date, endedAt),
          ),
        )
        .orderBy(asc(dailyReportSnapshots.date));

      return records.map(toDailyReportSnapshot);
    },
    async upsertDailyReportSnapshot(userId, snapshot) {
      const [record] = await db
        .insert(dailyReportSnapshots)
        .values({ ...snapshot, userId })
        .onConflictDoUpdate({
          set: {
            habitCompletion: snapshot.habitCompletion,
            streakDays: snapshot.streakDays,
            toiletLongMeeting: snapshot.toiletLongMeeting,
            toiletRecorded: snapshot.toiletRecorded,
            trainingDone: snapshot.trainingDone,
            updatedAt: new Date(),
          },
          target: [dailyReportSnapshots.userId, dailyReportSnapshots.date],
        })
        .returning();

      if (!record) {
        throw new Error('Failed to upsert daily report snapshot.');
      }

      return toDailyReportSnapshot(record);
    },
    async upsertDailyReportSnapshots(userId, snapshots) {
      if (snapshots.length === 0) {
        return [];
      }

      const records = await db
        .insert(dailyReportSnapshots)
        .values(snapshots.map((snapshot) => ({ ...snapshot, userId })))
        .onConflictDoUpdate({
          set: {
            habitCompletion: sql`excluded.habit_completion`,
            streakDays: sql`excluded.streak_days`,
            toiletLongMeeting: sql`excluded.toilet_long_meeting`,
            toiletRecorded: sql`excluded.toilet_recorded`,
            trainingDone: sql`excluded.training_done`,
            updatedAt: new Date(),
          },
          target: [dailyReportSnapshots.userId, dailyReportSnapshots.date],
        })
        .returning();

      return records.map(toDailyReportSnapshot).sort((left, right) => left.date.localeCompare(right.date));
    },
  };
}

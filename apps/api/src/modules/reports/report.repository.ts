import { and, asc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';

import type { DailyReportSnapshot } from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import {
  dailyReportSnapshots,
  dailyShareSnapshots,
  shareSettings,
  teamMembers,
  teams,
  users,
} from '../../db/schema.js';
import { toDailyReportSnapshot } from './report.mapper.js';

export type ReportTeamMemberRecord = {
  avatarUrl: string | null;
  displayName: string | null;
  id: string;
  nickname: string | null;
  status: typeof teamMembers.$inferSelect.status;
  userId: string;
};

export type ReportShareSettingsRecord = {
  paused: boolean;
  shareHabitCompletion: boolean;
  shareToiletRecorded: boolean;
  shareTraining: boolean;
  userId: string;
};

export type ReportShareSnapshotRecord = Pick<
  typeof dailyShareSnapshots.$inferSelect,
  'habitCompletion' | 'toiletRecorded' | 'trainingDone' | 'userId'
>;

export type ReportRepository = {
  findCurrentTeamId: (userId: string) => Promise<string | null>;
  listDailyReportSnapshots: (userId: string, startedAt: string, endedAt: string) => Promise<DailyReportSnapshot[]>;
  listTeamMembers: (teamId: string) => Promise<ReportTeamMemberRecord[]>;
  listTeamShareSettings: (teamId: string) => Promise<ReportShareSettingsRecord[]>;
  listTeamShareSnapshots: (
    userIds: string[],
    startedAt: string,
    endedAt: string,
  ) => Promise<ReportShareSnapshotRecord[]>;
  upsertDailyReportSnapshot: (userId: string, snapshot: DailyReportSnapshot) => Promise<DailyReportSnapshot>;
  upsertDailyReportSnapshots: (userId: string, snapshots: DailyReportSnapshot[]) => Promise<DailyReportSnapshot[]>;
};

export function createDrizzleReportRepository(db: Database): ReportRepository {
  return {
    async findCurrentTeamId(userId) {
      const [team] = await db
        .select({ id: teams.id })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(and(eq(teamMembers.userId, userId), ne(teamMembers.status, 'removed'), isNull(teams.archivedAt)))
        .limit(1);

      return team?.id ?? null;
    },
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
    async listTeamMembers(teamId) {
      return db
        .select({
          avatarUrl: users.avatarUrl,
          displayName: teamMembers.displayName,
          id: teamMembers.id,
          nickname: users.nickname,
          status: teamMembers.status,
          userId: users.id,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .where(and(eq(teamMembers.teamId, teamId), isNull(users.deletedAt)));
    },
    async listTeamShareSettings(teamId) {
      return db
        .select({
          paused: shareSettings.paused,
          shareHabitCompletion: shareSettings.shareHabitCompletion,
          shareToiletRecorded: shareSettings.shareToiletRecorded,
          shareTraining: shareSettings.shareTraining,
          userId: shareSettings.userId,
        })
        .from(shareSettings)
        .where(eq(shareSettings.teamId, teamId));
    },
    async listTeamShareSnapshots(userIds, startedAt, endedAt) {
      if (userIds.length === 0) {
        return [];
      }

      return db
        .select({
          habitCompletion: dailyShareSnapshots.habitCompletion,
          toiletRecorded: dailyShareSnapshots.toiletRecorded,
          trainingDone: dailyShareSnapshots.trainingDone,
          userId: dailyShareSnapshots.userId,
        })
        .from(dailyShareSnapshots)
        .where(
          and(
            inArray(dailyShareSnapshots.userId, userIds),
            gte(dailyShareSnapshots.date, startedAt),
            lte(dailyShareSnapshots.date, endedAt),
          ),
        );
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

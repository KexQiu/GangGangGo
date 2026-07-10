import { and, asc, eq, gte, inArray, isNull, lte, ne } from 'drizzle-orm';

import type {
  AdvancedReportResponse,
  DailyReportSnapshot,
  DailyReportSnapshotResponse,
  DailyReportSnapshotsBulkResponse,
  TeamWeeklyReportResponse,
} from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import {
  dailyReportSnapshots,
  dailyShareSnapshots,
  shareSettings,
  teamMembers,
  teams,
  users,
} from '../../db/schema.js';
import { ApiError } from '../../http/apiError.js';
import { deserializeAvatarConfig } from '../users/avatarConfig.js';
import type { CurrentUser } from '../users/userTypes.js';
import {
  buildAdvancedReport,
  dedupeSnapshotsByDate,
  defaultReportShareSettings,
  getAdvancedReportRange,
  getWeeklyRange,
  toDailyReportSnapshot,
} from './report.mapper.js';

export type ReportService = {
  getAdvancedReport: (currentUser: CurrentUser, range: '90d') => Promise<AdvancedReportResponse>;
  getTeamWeeklyReport: (currentUser: CurrentUser) => Promise<TeamWeeklyReportResponse>;
  upsertDailyReportSnapshot: (
    currentUser: CurrentUser,
    snapshot: DailyReportSnapshot,
  ) => Promise<DailyReportSnapshotResponse>;
  upsertDailyReportSnapshots: (
    currentUser: CurrentUser,
    snapshots: DailyReportSnapshot[],
  ) => Promise<DailyReportSnapshotsBulkResponse>;
};

export { createMockReportService } from './report.mock.js';

export function createDrizzleReportService(db: Database): ReportService {
  async function getCurrentTeam(currentUser: CurrentUser) {
    const [team] = await db
      .select({
        id: teams.id,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(
        and(
          eq(teamMembers.userId, currentUser.id),
          ne(teamMembers.status, 'removed'),
          isNull(teams.archivedAt),
        ),
      )
      .limit(1);

    if (!team) {
      throw new ApiError(404, 'not_found', '还没有小队。');
    }

    return team;
  }

  async function upsertSnapshot(currentUser: CurrentUser, snapshot: DailyReportSnapshot) {
    const [record] = await db
      .insert(dailyReportSnapshots)
      .values({
        habitCompletion: snapshot.habitCompletion,
        habitFull: snapshot.habitFull,
        ninetyDayHabitFullDays: snapshot.ninetyDayHabitFullDays,
        ninetyDayToiletLongMeetingCount: snapshot.ninetyDayToiletLongMeetingCount,
        ninetyDayTrainingDays: snapshot.ninetyDayTrainingDays,
        streakDays: snapshot.streakDays,
        thirtyDayHabitFullDays: snapshot.thirtyDayHabitFullDays,
        thirtyDayToiletLongMeetingCount: snapshot.thirtyDayToiletLongMeetingCount,
        thirtyDayTrainingDays: snapshot.thirtyDayTrainingDays,
        toiletLongMeeting: snapshot.toiletLongMeeting,
        toiletRecorded: snapshot.toiletRecorded,
        trainingDone: snapshot.trainingDone,
        weeklyHabitFullDays: snapshot.weeklyHabitFullDays,
        weeklyToiletLongMeetingCount: snapshot.weeklyToiletLongMeetingCount,
        weeklyTrainingDays: snapshot.weeklyTrainingDays,
        date: snapshot.date,
        userId: currentUser.id,
      })
      .onConflictDoUpdate({
        set: {
          habitCompletion: snapshot.habitCompletion,
          habitFull: snapshot.habitFull,
          ninetyDayHabitFullDays: snapshot.ninetyDayHabitFullDays,
          ninetyDayToiletLongMeetingCount: snapshot.ninetyDayToiletLongMeetingCount,
          ninetyDayTrainingDays: snapshot.ninetyDayTrainingDays,
          streakDays: snapshot.streakDays,
          thirtyDayHabitFullDays: snapshot.thirtyDayHabitFullDays,
          thirtyDayToiletLongMeetingCount: snapshot.thirtyDayToiletLongMeetingCount,
          thirtyDayTrainingDays: snapshot.thirtyDayTrainingDays,
          toiletLongMeeting: snapshot.toiletLongMeeting,
          toiletRecorded: snapshot.toiletRecorded,
          trainingDone: snapshot.trainingDone,
          updatedAt: new Date(),
          weeklyHabitFullDays: snapshot.weeklyHabitFullDays,
          weeklyToiletLongMeetingCount: snapshot.weeklyToiletLongMeetingCount,
          weeklyTrainingDays: snapshot.weeklyTrainingDays,
        },
        target: [dailyReportSnapshots.userId, dailyReportSnapshots.date],
      })
      .returning();

    if (!record) {
      throw new Error('Failed to upsert daily report snapshot.');
    }

    return toDailyReportSnapshot(record);
  }

  return {
    async getAdvancedReport(currentUser, range) {
      const { endedAt, startedAt } = getAdvancedReportRange(currentUser);
      const snapshots = await db
        .select()
        .from(dailyReportSnapshots)
        .where(
          and(
            eq(dailyReportSnapshots.userId, currentUser.id),
            gte(dailyReportSnapshots.date, startedAt),
            lte(dailyReportSnapshots.date, endedAt),
          ),
        )
        .orderBy(asc(dailyReportSnapshots.date));

      return buildAdvancedReport({
        endedAt,
        range,
        snapshots: snapshots.map(toDailyReportSnapshot),
        startedAt,
      });
    },
    async getTeamWeeklyReport(currentUser) {
      const { endedAt, startedAt } = getWeeklyRange();
      const team = await getCurrentTeam(currentUser);
      const members = await db
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
        .where(and(eq(teamMembers.teamId, team.id), isNull(users.deletedAt)));
      const activeMembers = members.filter((member) => member.status !== 'removed');
      const settingsRows = await db
        .select({
          paused: shareSettings.paused,
          shareHabitCompletion: shareSettings.shareHabitCompletion,
          shareToiletRecorded: shareSettings.shareToiletRecorded,
          shareTraining: shareSettings.shareTraining,
          userId: shareSettings.userId,
        })
        .from(shareSettings)
        .where(eq(shareSettings.teamId, team.id));
      const settingsByUserId = new Map(
        settingsRows.map((settings) => [
          settings.userId,
          {
            paused: settings.paused,
            shareHabitCompletion: settings.shareHabitCompletion,
            shareToiletRecorded: settings.shareToiletRecorded,
            shareTraining: settings.shareTraining,
          },
        ]),
      );
      const snapshots = await db
        .select()
        .from(dailyShareSnapshots)
        .where(
          and(
            inArray(
              dailyShareSnapshots.userId,
              activeMembers.map((member) => member.userId),
            ),
            gte(dailyShareSnapshots.date, startedAt),
            lte(dailyShareSnapshots.date, endedAt),
          ),
        );

      return {
        endedAt,
        memberCount: activeMembers.length,
        startedAt,
        summaries: activeMembers.map((member) => {
          const memberShareSettings = settingsByUserId.get(member.userId) ?? defaultReportShareSettings;
          const memberSnapshots = snapshots.filter((snapshot) => snapshot.userId === member.userId);
          const visibleSnapshots =
            member.status === 'paused' || memberShareSettings.paused ? [] : memberSnapshots;

          return {
            habitFullDays: memberShareSettings.shareHabitCompletion
              ? visibleSnapshots.filter((snapshot) => snapshot.habitCompletion === 4).length
              : 0,
            member: {
              displayName: member.displayName,
              id: member.id,
              user: {
                avatarUrl: deserializeAvatarConfig(member.avatarUrl),
                id: member.userId,
                nickname: member.nickname,
              },
            },
            toiletRecordedDays: memberShareSettings.shareToiletRecorded
              ? visibleSnapshots.filter((snapshot) => snapshot.toiletRecorded).length
              : 0,
            trainingDays: memberShareSettings.shareTraining
              ? visibleSnapshots.filter((snapshot) => snapshot.trainingDone).length
              : 0,
          };
        }),
      };
    },
    async upsertDailyReportSnapshot(currentUser, snapshot) {
      return {
        snapshot: await upsertSnapshot(currentUser, snapshot),
      };
    },
    async upsertDailyReportSnapshots(currentUser, snapshots) {
      const uploadedSnapshots: DailyReportSnapshot[] = [];

      for (const snapshot of dedupeSnapshotsByDate(snapshots)) {
        uploadedSnapshots.push(await upsertSnapshot(currentUser, snapshot));
      }

      return {
        snapshots: uploadedSnapshots,
      };
    },
  };
}

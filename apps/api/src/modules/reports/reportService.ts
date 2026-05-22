import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';

import type {
  AdvancedReportResponse,
  DailyReportSnapshotResponse,
  DailyReportSnapshot,
  TeamMember,
  TeamWeeklyReportResponse,
} from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import { dailyReportSnapshots, dailyShareSnapshots, teamMembers, teams, users } from '../../db/schema.js';
import { ApiError } from '../../http/apiError.js';
import type { TeamService } from '../teams/teamService.js';
import type { CurrentUser } from '../users/userTypes.js';

export type ReportService = {
  getAdvancedReport: (currentUser: CurrentUser, range: '90d') => Promise<AdvancedReportResponse>;
  getTeamWeeklyReport: (currentUser: CurrentUser) => Promise<TeamWeeklyReportResponse>;
  upsertDailyReportSnapshot: (
    currentUser: CurrentUser,
    snapshot: DailyReportSnapshot,
  ) => Promise<DailyReportSnapshotResponse>;
};

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function getWeeklyRange(now = new Date()) {
  const endedAt = toDateString(now);
  const startedAt = toDateString(addDays(now, -6));

  return { endedAt, startedAt };
}

function eachDateInRange(startedAt: string, endedAt: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startedAt}T00:00:00.000Z`);
  const end = new Date(`${endedAt}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(toDateString(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function toDailyReportSnapshot(record: typeof dailyReportSnapshots.$inferSelect): DailyReportSnapshot {
  return {
    date: record.date,
    habitCompletion: record.habitCompletion as DailyReportSnapshot['habitCompletion'],
    habitFull: record.habitFull,
    ninetyDayHabitFullDays: record.ninetyDayHabitFullDays,
    ninetyDayToiletLongMeetingCount: record.ninetyDayToiletLongMeetingCount,
    ninetyDayTrainingDays: record.ninetyDayTrainingDays,
    streakDays: record.streakDays,
    thirtyDayHabitFullDays: record.thirtyDayHabitFullDays,
    thirtyDayToiletLongMeetingCount: record.thirtyDayToiletLongMeetingCount,
    thirtyDayTrainingDays: record.thirtyDayTrainingDays,
    toiletLongMeeting: record.toiletLongMeeting,
    toiletRecorded: record.toiletRecorded,
    trainingDone: record.trainingDone,
    weeklyHabitFullDays: record.weeklyHabitFullDays as DailyReportSnapshot['weeklyHabitFullDays'],
    weeklyToiletLongMeetingCount: record.weeklyToiletLongMeetingCount,
    weeklyTrainingDays: record.weeklyTrainingDays as DailyReportSnapshot['weeklyTrainingDays'],
  };
}

function toWeeklyMember(member: Pick<TeamMember, 'displayName' | 'id' | 'user'>) {
  return {
    displayName: member.displayName,
    id: member.id,
    user: member.user,
  };
}

export function createMockReportService(options: { teamService: TeamService }): ReportService {
  const snapshotsByUserAndDate = new Map<string, DailyReportSnapshot>();

  function snapshotKey(userId: string, date: string) {
    return `${userId}:${date}`;
  }

  return {
    async getAdvancedReport(currentUser) {
      const latestSnapshot = [...snapshotsByUserAndDate.entries()]
        .filter(([key]) => key.startsWith(`${currentUser.id}:`))
        .map(([, snapshot]) => snapshot)
        .sort((left, right) => right.date.localeCompare(left.date))[0];

      return {
        range: '90d',
        snapshot: latestSnapshot ?? null,
      };
    },
    async getTeamWeeklyReport(currentUser) {
      const { endedAt, startedAt } = getWeeklyRange();
      const dates = eachDateInRange(startedAt, endedAt);
      const teamResponse = await options.teamService.getCurrentTeam(currentUser);
      const team = teamResponse.team;

      if (!team) {
        throw new ApiError(404, 'not_found', '还没有小队。');
      }

      const snapshotsByMemberId = new Map<
        string,
        {
          habitFullDays: number;
          member: Pick<TeamMember, 'displayName' | 'id' | 'user'>;
          toiletRecordedDays: number;
          trainingDays: number;
        }
      >();

      for (const member of team.members) {
        snapshotsByMemberId.set(member.id, {
          habitFullDays: 0,
          member: toWeeklyMember(member),
          toiletRecordedDays: 0,
          trainingDays: 0,
        });
      }

      for (const date of dates) {
        const teamSnapshots = await options.teamService.getCurrentTeamSnapshots(currentUser, date);

        for (const item of teamSnapshots.snapshots) {
          const summary = snapshotsByMemberId.get(item.member.id);

          if (!summary || !item.snapshot) {
            continue;
          }

          summary.trainingDays += item.snapshot.trainingDone ? 1 : 0;
          summary.habitFullDays += item.snapshot.habitCompletion === 4 ? 1 : 0;
          summary.toiletRecordedDays += item.snapshot.toiletRecorded ? 1 : 0;
        }
      }

      return {
        endedAt,
        memberCount: team.members.length,
        startedAt,
        summaries: [...snapshotsByMemberId.values()],
      };
    },
    async upsertDailyReportSnapshot(currentUser, snapshot) {
      snapshotsByUserAndDate.set(snapshotKey(currentUser.id, snapshot.date), snapshot);

      return {
        snapshot,
      };
    },
  };
}

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
          eq(teamMembers.status, 'active'),
          isNull(teams.archivedAt),
        ),
      )
      .limit(1);

    if (!team) {
      throw new ApiError(404, 'not_found', '还没有小队。');
    }

    return team;
  }

  return {
    async getAdvancedReport(currentUser, range) {
      const [snapshot] = await db
        .select()
        .from(dailyReportSnapshots)
        .where(eq(dailyReportSnapshots.userId, currentUser.id))
        .orderBy(desc(dailyReportSnapshots.date))
        .limit(1);

      return {
        range,
        snapshot: snapshot ? toDailyReportSnapshot(snapshot) : null,
      };
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
          const memberSnapshots = snapshots.filter((snapshot) => snapshot.userId === member.userId);

          return {
            habitFullDays: memberSnapshots.filter((snapshot) => snapshot.habitCompletion === 4).length,
            member: {
              displayName: member.displayName,
              id: member.id,
              user: {
                avatarUrl: member.avatarUrl,
                id: member.userId,
                nickname: member.nickname,
              },
            },
            toiletRecordedDays: memberSnapshots.filter((snapshot) => snapshot.toiletRecorded).length,
            trainingDays: memberSnapshots.filter((snapshot) => snapshot.trainingDone).length,
          };
        }),
      };
    },
    async upsertDailyReportSnapshot(currentUser, snapshot) {
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

      return {
        snapshot: toDailyReportSnapshot(record),
      };
    },
  };
}

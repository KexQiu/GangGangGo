import { and, asc, eq, gte, inArray, isNull, lte, ne } from 'drizzle-orm';

import type {
  AdvancedReportDay,
  AdvancedReportResponse,
  DailyReportSnapshot,
  DailyReportSnapshotResponse,
  DailyReportSnapshotsBulkResponse,
  TeamMember,
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
import type { TeamService } from '../teams/teamService.js';
import { deserializeAvatarConfig } from '../users/avatarConfig.js';
import type { CurrentUser } from '../users/userTypes.js';

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

const advancedReportDayCount = 90;
const defaultTimezone = 'Asia/Shanghai';

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function addDaysToDateKey(dateKey: string, days: number) {
  return toDateString(addDays(new Date(`${dateKey}T00:00:00.000Z`), days));
}

function getTimezoneDateKey(timezone: string | null | undefined, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      timeZone: timezone || defaultTimezone,
      year: 'numeric',
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return getTimezoneDateKey(defaultTimezone, now);
  }
}

function getAdvancedReportRange(currentUser: CurrentUser, now = new Date()) {
  const endedAt = getTimezoneDateKey(currentUser.timezone, now);
  const startedAt = addDaysToDateKey(endedAt, -(advancedReportDayCount - 1));

  return { endedAt, startedAt };
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

function toAdvancedReportDay(date: string, snapshot?: DailyReportSnapshot): AdvancedReportDay {
  return {
    date,
    habitCompletion: snapshot?.habitCompletion ?? 0,
    habitFull: snapshot?.habitFull ?? false,
    toiletLongMeeting: snapshot?.toiletLongMeeting ?? false,
    toiletRecorded: snapshot?.toiletRecorded ?? false,
    trainingDone: snapshot?.trainingDone ?? false,
  };
}

function hasAnyAdvancedReportRecord(day: AdvancedReportDay) {
  return day.trainingDone || day.habitCompletion > 0 || day.toiletRecorded || day.toiletLongMeeting;
}

function buildAdvancedReport(input: {
  endedAt: string;
  range: '90d';
  snapshots: DailyReportSnapshot[];
  startedAt: string;
}): AdvancedReportResponse {
  const snapshotsByDate = new Map(input.snapshots.map((snapshot) => [snapshot.date, snapshot]));
  const days = eachDateInRange(input.startedAt, input.endedAt).map((date) =>
    toAdvancedReportDay(date, snapshotsByDate.get(date)),
  );
  const latestSnapshot = input.snapshots.at(-1) ?? null;

  return {
    days,
    endedAt: input.endedAt,
    range: input.range,
    snapshot: latestSnapshot,
    startedAt: input.startedAt,
    summary: {
      currentStreakDays: latestSnapshot?.streakDays ?? 0,
      habitFullDays: days.filter((day) => day.habitFull).length,
      hasAnyRecord: days.some(hasAnyAdvancedReportRecord),
      recordDays: days.filter(hasAnyAdvancedReportRecord).length,
      toiletLongMeetingCount: latestSnapshot?.ninetyDayToiletLongMeetingCount ?? 0,
      toiletRecordDays: days.filter((day) => day.toiletRecorded).length,
      trainingDays: days.filter((day) => day.trainingDone).length,
    },
  };
}

function dedupeSnapshotsByDate(snapshots: DailyReportSnapshot[]) {
  const snapshotsByDate = new Map<string, DailyReportSnapshot>();

  for (const snapshot of snapshots) {
    snapshotsByDate.set(snapshot.date, snapshot);
  }

  return [...snapshotsByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
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

type ReportShareSettings = {
  paused: boolean;
  shareHabitCompletion: boolean;
  shareToiletRecorded: boolean;
  shareTraining: boolean;
};

const defaultReportShareSettings: ReportShareSettings = {
  paused: false,
  shareHabitCompletion: true,
  shareToiletRecorded: true,
  shareTraining: true,
};

export function createMockReportService(options: { teamService: TeamService }): ReportService {
  const snapshotsByUserAndDate = new Map<string, DailyReportSnapshot>();

  function snapshotKey(userId: string, date: string) {
    return `${userId}:${date}`;
  }

  return {
    async getAdvancedReport(currentUser, range) {
      const { endedAt, startedAt } = getAdvancedReportRange(currentUser);
      const snapshots = [...snapshotsByUserAndDate.entries()]
        .filter(([key]) => key.startsWith(`${currentUser.id}:`))
        .map(([, snapshot]) => snapshot)
        .filter((snapshot) => snapshot.date >= startedAt && snapshot.date <= endedAt)
        .sort((left, right) => left.date.localeCompare(right.date));

      return buildAdvancedReport({ endedAt, range, snapshots, startedAt });
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
    async upsertDailyReportSnapshots(currentUser, snapshots) {
      const dedupedSnapshots = dedupeSnapshotsByDate(snapshots);

      for (const snapshot of dedupedSnapshots) {
        snapshotsByUserAndDate.set(snapshotKey(currentUser.id, snapshot.date), snapshot);
      }

      return {
        snapshots: dedupedSnapshots,
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

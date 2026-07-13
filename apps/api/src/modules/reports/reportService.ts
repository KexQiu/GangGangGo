import type {
  AdvancedReportResponse,
  DailyReportSnapshot,
  DailyReportSnapshotResponse,
  DailyReportSnapshotsBulkResponse,
  TeamWeeklyReportResponse,
} from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import { ApiError } from '../../http/apiError.js';
import { deserializeAvatarConfig } from '../users/avatarConfig.js';
import type { CurrentUser } from '../users/userTypes.js';
import {
  buildAdvancedReport,
  dedupeSnapshotsByDate,
  defaultReportShareSettings,
  getAdvancedReportRange,
  getWeeklyRange,
} from './report.mapper.js';
import { createDrizzleReportRepository, type ReportRepository } from './report.repository.js';

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

export function createReportService(repository: ReportRepository): ReportService {
  async function getCurrentTeamId(currentUser: CurrentUser) {
    const teamId = await repository.findCurrentTeamId(currentUser.id);

    if (!teamId) {
      throw new ApiError(404, 'not_found', '还没有小队。');
    }

    return teamId;
  }

  return {
    async getAdvancedReport(currentUser, range) {
      const { endedAt, startedAt } = getAdvancedReportRange(currentUser);
      const snapshots = await repository.listDailyReportSnapshots(currentUser.id, startedAt, endedAt);

      return buildAdvancedReport({
        endedAt,
        range,
        snapshots,
        startedAt,
      });
    },
    async getTeamWeeklyReport(currentUser) {
      const { endedAt, startedAt } = getWeeklyRange();
      const teamId = await getCurrentTeamId(currentUser);
      const members = await repository.listTeamMembers(teamId);
      const activeMembers = members.filter((member) => member.status !== 'removed');
      const activeMemberIds = activeMembers.map((member) => member.userId);
      const [settingsRows, snapshots] = await Promise.all([
        repository.listTeamShareSettings(teamId),
        repository.listTeamShareSnapshots(activeMemberIds, startedAt, endedAt),
      ]);
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

      return {
        endedAt,
        memberCount: activeMembers.length,
        startedAt,
        summaries: activeMembers.map((member) => {
          const memberShareSettings = settingsByUserId.get(member.userId) ?? defaultReportShareSettings;
          const memberSnapshots = snapshots.filter((snapshot) => snapshot.userId === member.userId);
          const visibleSnapshots = member.status === 'paused' || memberShareSettings.paused ? [] : memberSnapshots;

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
        snapshot: await repository.upsertDailyReportSnapshot(currentUser.id, snapshot),
      };
    },
    async upsertDailyReportSnapshots(currentUser, snapshots) {
      const deduped = dedupeSnapshotsByDate(snapshots);

      return {
        snapshots: await repository.upsertDailyReportSnapshots(currentUser.id, deduped),
      };
    },
  };
}

export function createDrizzleReportService(db: Database): ReportService {
  return createReportService(createDrizzleReportRepository(db));
}

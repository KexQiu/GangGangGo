import type { DailyReportSnapshot, TeamMember } from '@xiaotidu/contracts';

import { ApiError } from '../../http/apiError.js';
import type { TeamService } from '../teams/teamService.js';
import {
  buildAdvancedReport,
  dedupeSnapshotsByDate,
  eachDateInRange,
  getAdvancedReportRange,
  getWeeklyRange,
  toWeeklyMember,
} from './report.mapper.js';
import type { ReportService } from './reportService.js';

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

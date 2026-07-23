import type { DailyReportSnapshot } from '@xiaotidu/contracts';

import { buildAdvancedReport, dedupeSnapshotsByDate, getAdvancedReportRange } from './report.mapper.js';
import type { ReportService } from './reportService.js';

export function createMockReportService(): ReportService {
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

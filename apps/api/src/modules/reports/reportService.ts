import type {
  AdvancedReportResponse,
  DailyReportSnapshot,
  DailyReportSnapshotResponse,
  DailyReportSnapshotsBulkResponse,
} from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import type { CurrentUser } from '../users/userTypes.js';
import { buildAdvancedReport, dedupeSnapshotsByDate, getAdvancedReportRange } from './report.mapper.js';
import { createDrizzleReportRepository, type ReportRepository } from './report.repository.js';

export type ReportService = {
  getAdvancedReport: (currentUser: CurrentUser, range: '90d') => Promise<AdvancedReportResponse>;
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

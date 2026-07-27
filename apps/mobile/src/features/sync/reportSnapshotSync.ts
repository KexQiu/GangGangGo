import { reportsApi } from '../../api/client';
import { buildLocalDateRange } from '../../storage/dateRange';
import { collectAllPages } from '../../storage/pagination';
import { listHabitCheckInsPage } from '../../storage/repositories/habitRepository';
import { listToiletSessionsPage, type ToiletSessionCursor } from '../../storage/repositories/toiletRepository';
import { listTrainingSessionsPage, type TrainingSessionCursor } from '../../storage/repositories/trainingRepository';
import { getCachedFeatureAccess } from '../account/accountQueryService';
import { useAuthStore } from '../account/authStore';
import {
  buildRecentReportSnapshots,
  recentReportDays,
  type ReportSnapshotInput,
} from '../reports/reportSnapshotBuilder';
import type { ToiletSession } from '../toilet/toiletTypes';
import type { TrainingSession } from '../training/trainingTypes';
import { trackGrowthEvent } from '../growth/growthEventTracker';

export async function syncTodayReportSnapshot(): Promise<boolean> {
  return syncRecentReportSnapshots();
}

export async function syncRecentReportSnapshots(): Promise<boolean> {
  const { accessToken } = useAuthStore.getState();
  if (!accessToken || !getCachedFeatureAccess('reportSnapshotSync')) return false;

  try {
    const now = new Date();
    const input = await loadRecentReportInput(now);
    await reportsApi.upsertReportSnapshotsBulk({ snapshots: buildRecentReportSnapshots(input, now) }, accessToken);
    return true;
  } catch {
    trackGrowthEvent('sync_failed', { domain: 'report', source: 'trends' });
    return false;
  }
}

async function loadRecentReportInput(now: Date): Promise<ReportSnapshotInput> {
  const range = buildLocalDateRange(recentReportDays, now);
  const habitPage = await listHabitCheckInsPage({
    fromDate: range.fromDate,
    limit: recentReportDays,
    toDateExclusive: range.toDateExclusive,
  });
  const [toiletSessions, trainingSessions] = await Promise.all([
    collectAllPages<ToiletSession, ToiletSessionCursor>((cursor) =>
      listToiletSessionsPage({
        cursor,
        fromDateTime: range.fromDateTime,
        limit: 250,
        toDateTimeExclusive: range.toDateTimeExclusive,
      }),
    ),
    collectAllPages<TrainingSession, TrainingSessionCursor>((cursor) =>
      listTrainingSessionsPage({
        cursor,
        fromDateTime: range.fromDateTime,
        limit: 250,
        toDateTimeExclusive: range.toDateTimeExclusive,
      }),
    ),
  ]);

  return {
    habitCheckIns: habitPage.items,
    toiletSessions,
    trainingSessions,
  };
}

import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';

import type { DailyReportSnapshot } from '@xiaotidu/contracts';

import type { DatabaseClient } from '../db/client.js';
import { dailyReportSnapshots } from '../db/schema.js';
import { getAdvancedReportRange } from '../modules/reports/report.mapper.js';
import { createDrizzleReportService } from '../modules/reports/reportService.js';
import {
  addDaysToDateKey,
  cleanupIntegrationUsers,
  createIntegrationDatabaseClient,
  createIntegrationUser,
  createQueryCounter,
  describeWithDatabase,
} from './postgresTestUtils.js';

describeWithDatabase('postgres report integration', () => {
  let client: DatabaseClient;
  const createdUserIds: string[] = [];
  const queryCounter = createQueryCounter();

  beforeAll(() => {
    client = createIntegrationDatabaseClient(queryCounter);
  });

  afterAll(async () => {
    await cleanupIntegrationUsers(client, createdUserIds);
  });

  it('bulk upserts 90 reports in one SQL and computes 7/30/90-day summaries', async () => {
    const user = await createIntegrationUser(client, createdUserIds, 'bulk-report-user');
    const service = createDrizzleReportService(client.db);
    const { endedAt, startedAt } = getAdvancedReportRange(user);
    const snapshots = Array.from({ length: 90 }, (_, index): DailyReportSnapshot => ({
      date: addDaysToDateKey(startedAt, index),
      habitCompletion: index % 2 === 0 ? 4 : 0,
      streakDays: index + 1,
      toiletLongMeeting: index % 10 === 0,
      toiletRecorded: index % 5 === 0,
      trainingDone: index % 3 === 0,
    }));

    queryCounter.reset();
    const uploaded = await service.upsertDailyReportSnapshots(user, snapshots);
    expect(uploaded.snapshots).toHaveLength(90);
    expect(queryCounter.count()).toBe(1);
    expect(queryCounter.queries()[0]).toContain('insert into "daily_report_snapshots"');

    const [storedCount] = await client.db
      .select({ value: count() })
      .from(dailyReportSnapshots)
      .where(eq(dailyReportSnapshots.userId, user.id));
    expect(storedCount?.value).toBe(90);

    const overwritten = { ...snapshots[0]!, habitCompletion: 1 as const, trainingDone: true };
    queryCounter.reset();
    await service.upsertDailyReportSnapshots(user, [{ ...overwritten, habitCompletion: 2 }, overwritten]);
    expect(queryCounter.count()).toBe(1);

    const report = await service.getAdvancedReport(user, '90d');
    expect(report).toMatchObject({ endedAt, startedAt });
    expect(report.days).toHaveLength(90);
    expect(report.days[0]).toMatchObject({ habitCompletion: 1, trainingDone: true });
    expect(report.summaries['7d']).toEqual(summarizeSnapshots(snapshots.slice(-7)));
    expect(report.summaries['30d']).toEqual(summarizeSnapshots(snapshots.slice(-30)));
    expect(report.summaries['90d']).toEqual(summarizeSnapshots([overwritten, ...snapshots.slice(1)]));

    const outsideRange = { ...snapshots[0]!, date: addDaysToDateKey(startedAt, -1) };
    await service.upsertDailyReportSnapshot(user, outsideRange);
    const filteredReport = await service.getAdvancedReport(user, '90d');
    expect(filteredReport.days).toHaveLength(90);
    expect(filteredReport.startedAt).toBe(startedAt);
  });
});

function summarizeSnapshots(snapshots: DailyReportSnapshot[]) {
  return {
    currentStreakDays: snapshots.at(-1)?.streakDays ?? 0,
    habitFullDays: snapshots.filter((snapshot) => snapshot.habitCompletion === 4).length,
    hasAnyRecord: snapshots.some(
      (snapshot) =>
        snapshot.trainingDone || snapshot.habitCompletion > 0 || snapshot.toiletRecorded || snapshot.toiletLongMeeting,
    ),
    recordDays: snapshots.filter(
      (snapshot) =>
        snapshot.trainingDone || snapshot.habitCompletion > 0 || snapshot.toiletRecorded || snapshot.toiletLongMeeting,
    ).length,
    toiletLongMeetingCount: snapshots.filter((snapshot) => snapshot.toiletLongMeeting).length,
    toiletRecordDays: snapshots.filter((snapshot) => snapshot.toiletRecorded).length,
    trainingDays: snapshots.filter((snapshot) => snapshot.trainingDone).length,
  };
}

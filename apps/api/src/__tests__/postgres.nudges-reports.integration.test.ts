import { and, count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';

import type { DailyReportSnapshot } from '@xiaotidu/contracts';

import type { DatabaseClient } from '../db/client.js';
import { buddyNudgeAcks, dailyReportSnapshots } from '../db/schema.js';
import { createDrizzleNudgeService } from '../modules/nudges/nudgeService.js';
import { getAdvancedReportRange } from '../modules/reports/report.mapper.js';
import { createDrizzleReportService } from '../modules/reports/reportService.js';
import { createDrizzleTeamService } from '../modules/teams/teamService.js';
import {
  addDaysToDateKey,
  cleanupIntegrationUsers,
  createIntegrationDatabaseClient,
  createIntegrationUser,
  createQueryCounter,
  describeWithDatabase,
} from './postgresTestUtils.js';

describeWithDatabase('postgres nudge and report integration', () => {
  let client: DatabaseClient;
  const createdUserIds: string[] = [];
  const queryCounter = createQueryCounter();

  beforeAll(() => {
    client = createIntegrationDatabaseClient(queryCounter);
  });

  afterAll(async () => {
    await cleanupIntegrationUsers(client, createdUserIds);
  });

  async function createTeamPair(label: string) {
    const teamService = createDrizzleTeamService(client.db);
    const owner = await createIntegrationUser(client, createdUserIds, `${label}-owner`);
    const buddy = await createIntegrationUser(client, createdUserIds, `${label}-buddy`);
    await teamService.createTeam(owner, { name: `${label} 队` });
    const invite = await teamService.createInvite(owner);
    await teamService.acceptInvite(buddy, invite.token, {});
    return { buddy, owner };
  }

  it('enforces concurrent daily nudge limits without 500 errors and keeps list query counts fixed', async () => {
    const { buddy, owner } = await createTeamPair('提醒额度');
    const service = createDrizzleNudgeService(client.db);

    queryCounter.reset();
    expect((await service.listInbox(buddy)).nudges).toHaveLength(0);
    const emptyInboxQueryCount = queryCounter.count();

    queryCounter.reset();
    expect((await service.listThread(owner, buddy.id, { limit: 50 })).nudges).toHaveLength(0);
    const emptyThreadQueryCount = queryCounter.count();

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => service.createNudge(owner, { toUserId: buddy.id, type: 'gentle' })),
    );
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(5);
    expect(rejected).toHaveLength(3);
    expect(rejected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: expect.objectContaining({ code: 'rate_limited', statusCode: 429 }) }),
      ]),
    );
    expect(rejected.every((result) => result.reason?.statusCode !== 500)).toBe(true);

    queryCounter.reset();
    expect((await service.listInbox(buddy)).nudges).toHaveLength(5);
    expect(queryCounter.count()).toBe(emptyInboxQueryCount);
    expect(emptyInboxQueryCount).toBe(1);

    queryCounter.reset();
    expect((await service.listThread(owner, buddy.id, { limit: 50 })).nudges).toHaveLength(5);
    expect(queryCounter.count()).toBe(emptyThreadQueryCount);
    expect(emptyThreadQueryCount).toBe(3);
  });

  it('makes concurrent ACK creation idempotent and permits only one status revision', async () => {
    const { buddy, owner } = await createTeamPair('回执竞争');
    const service = createDrizzleNudgeService(client.db);
    const nudge = await service.createNudge(owner, { toUserId: buddy.id, type: 'move' });
    const createResults = await Promise.allSettled(
      Array.from({ length: 6 }, () => service.ackNudge(buddy, nudge.id, 'received')),
    );

    expect(createResults.every((result) => result.status === 'fulfilled')).toBe(true);
    for (const result of createResults) {
      if (result.status === 'fulfilled') {
        expect(result.value.ack).toMatchObject({ revisionCount: 0, status: 'received' });
      }
    }

    const idempotent = await service.ackNudge(buddy, nudge.id, 'received');
    expect(idempotent.ack).toMatchObject({ revisionCount: 0, status: 'received' });

    const revisionResults = await Promise.allSettled([
      service.ackNudge(buddy, nudge.id, 'later'),
      service.ackNudge(buddy, nudge.id, 'done'),
    ]);
    expect(revisionResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(revisionResults.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const [storedAck] = await client.db
      .select()
      .from(buddyNudgeAcks)
      .where(and(eq(buddyNudgeAcks.nudgeId, nudge.id), eq(buddyNudgeAcks.userId, buddy.id)));
    expect(storedAck).toMatchObject({ revisionCount: 1 });

    const finalStatus = storedAck!.status;
    expect((await service.ackNudge(buddy, nudge.id, finalStatus)).ack).toMatchObject({
      revisionCount: 1,
      status: finalStatus,
    });
    const anotherStatus = finalStatus === 'done' ? 'later' : 'done';
    await expect(service.ackNudge(buddy, nudge.id, anotherStatus)).rejects.toMatchObject({
      code: 'conflict',
      statusCode: 409,
    });
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

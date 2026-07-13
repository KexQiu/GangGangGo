import { describe, expect, it, vi } from 'vitest';

import type { DailyReportSnapshot } from '@xiaotidu/contracts';

import type { CurrentUser } from '../users/userTypes.js';
import type { ReportRepository } from './report.repository.js';
import { createReportService } from './reportService.js';

const currentUser: CurrentUser = {
  appleUserId: 'report-service-user',
  avatarUrl: null,
  id: '00000000-0000-4000-8000-000000000101',
  nickname: '报告用户',
  timezone: 'Asia/Shanghai',
};

function createRepository(overrides: Partial<ReportRepository> = {}): ReportRepository {
  return {
    findCurrentTeamId: vi.fn(async () => null),
    listDailyReportSnapshots: vi.fn(async () => []),
    listTeamMembers: vi.fn(async () => []),
    listTeamShareSettings: vi.fn(async () => []),
    listTeamShareSnapshots: vi.fn(async () => []),
    upsertDailyReportSnapshot: vi.fn(async (_userId, snapshot) => snapshot),
    upsertDailyReportSnapshots: vi.fn(async (_userId, snapshots) => snapshots),
    ...overrides,
  };
}

function snapshot(date: string, habitCompletion: DailyReportSnapshot['habitCompletion']): DailyReportSnapshot {
  return {
    date,
    habitCompletion,
    streakDays: habitCompletion,
    toiletLongMeeting: false,
    toiletRecorded: habitCompletion > 0,
    trainingDone: habitCompletion === 4,
  };
}

describe('report service', () => {
  it('deduplicates a bulk upload before one repository write', async () => {
    const repository = createRepository();
    const service = createReportService(repository);
    const first = snapshot('2026-07-11', 1);
    const replacement = snapshot('2026-07-11', 4);
    const next = snapshot('2026-07-12', 2);

    await expect(service.upsertDailyReportSnapshots(currentUser, [first, next, replacement])).resolves.toEqual({
      snapshots: [replacement, next],
    });
    expect(repository.upsertDailyReportSnapshots).toHaveBeenCalledTimes(1);
    expect(repository.upsertDailyReportSnapshots).toHaveBeenCalledWith(currentUser.id, [replacement, next]);
  });

  it('applies member status and share settings to weekly totals', async () => {
    const repository = createRepository({
      findCurrentTeamId: vi.fn(async () => 'team-1'),
      listTeamMembers: vi.fn(async () => [
        {
          avatarUrl: null,
          displayName: '甲',
          id: 'member-1',
          nickname: '甲',
          status: 'active' as const,
          userId: 'user-1',
        },
        {
          avatarUrl: null,
          displayName: '乙',
          id: 'member-2',
          nickname: '乙',
          status: 'paused' as const,
          userId: 'user-2',
        },
      ]),
      listTeamShareSettings: vi.fn(async () => [
        {
          paused: false,
          shareHabitCompletion: true,
          shareToiletRecorded: false,
          shareTraining: true,
          userId: 'user-1',
        },
      ]),
      listTeamShareSnapshots: vi.fn(async () => [
        { habitCompletion: 4, toiletRecorded: true, trainingDone: true, userId: 'user-1' },
        { habitCompletion: 4, toiletRecorded: true, trainingDone: true, userId: 'user-2' },
      ]),
    });
    const service = createReportService(repository);

    const report = await service.getTeamWeeklyReport(currentUser);

    expect(report.memberCount).toBe(2);
    expect(report.summaries).toEqual([
      expect.objectContaining({ habitFullDays: 1, toiletRecordedDays: 0, trainingDays: 1 }),
      expect.objectContaining({ habitFullDays: 0, toiletRecordedDays: 0, trainingDays: 0 }),
    ]);
  });

  it('returns not found before loading weekly team data', async () => {
    const repository = createRepository();
    const service = createReportService(repository);

    await expect(service.getTeamWeeklyReport(currentUser)).rejects.toMatchObject({
      code: 'not_found',
      statusCode: 404,
    });
    expect(repository.listTeamMembers).not.toHaveBeenCalled();
  });
});

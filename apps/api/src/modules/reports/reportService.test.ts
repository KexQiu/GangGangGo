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
    listDailyReportSnapshots: vi.fn(async () => []),
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
});

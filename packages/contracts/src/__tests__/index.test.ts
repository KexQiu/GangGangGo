import { describe, expect, it } from 'vitest';

import {
  type AdvancedReportResponse,
  type ApiSuccessResponse,
  authResponseSchema,
  dailyReportSnapshotSchema,
  upsertDailyReportSnapshotsBulkRequestSchema,
  userProfileSchema,
} from '../index.js';

describe('contracts exports', () => {
  it('validates auth sessions at runtime', () => {
    const user = userProfileSchema.parse({
      avatarUrl: null,
      id: '00000000-0000-4000-8000-000000000001',
      nickname: null,
      timezone: 'Asia/Shanghai',
    });
    expect(
      authResponseSchema.safeParse({
        session: {
          accessToken: 'access',
          accessTokenExpiresAt: '2026-07-11T12:00:00.000Z',
          refreshToken: 'refresh',
        },
        user,
      }).success,
    ).toBe(true);
  });

  it('rejects sensitive or redundant report fields and batches over 90 days', () => {
    const snapshot = {
      date: '2026-07-11',
      habitCompletion: 4,
      streakDays: 2,
      toiletLongMeeting: false,
      toiletRecorded: true,
      trainingDone: true,
    };
    expect(dailyReportSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(upsertDailyReportSnapshotsBulkRequestSchema.safeParse({ snapshots: Array(91).fill(snapshot) }).success).toBe(
      false,
    );
    expect(dailyReportSnapshotSchema.safeParse({ ...snapshot, bleeding: true }).success).toBe(false);
  });

  it('keeps advanced report responses compatible with daily snapshot summaries', () => {
    const response = {
      data: {
        days: [
          {
            date: '2026-05-22',
            habitCompletion: 4,
            habitFull: true,
            toiletLongMeeting: false,
            toiletRecorded: true,
            trainingDone: true,
          },
        ],
        endedAt: '2026-05-22',
        range: '90d',
        snapshot: null,
        startedAt: '2026-02-22',
        summaries: {
          '7d': {
            currentStreakDays: 3,
            habitFullDays: 1,
            hasAnyRecord: true,
            recordDays: 1,
            toiletLongMeetingCount: 0,
            toiletRecordDays: 1,
            trainingDays: 1,
          },
          '30d': {
            currentStreakDays: 3,
            habitFullDays: 1,
            hasAnyRecord: true,
            recordDays: 1,
            toiletLongMeetingCount: 0,
            toiletRecordDays: 1,
            trainingDays: 1,
          },
          '90d': {
            currentStreakDays: 3,
            habitFullDays: 1,
            hasAnyRecord: true,
            recordDays: 1,
            toiletLongMeetingCount: 0,
            toiletRecordDays: 1,
            trainingDays: 1,
          },
        },
      },
    } satisfies ApiSuccessResponse<AdvancedReportResponse>;

    expect(response.data.range).toBe('90d');
    expect(response.data.days[0]?.habitCompletion).toBe(4);
  });
});

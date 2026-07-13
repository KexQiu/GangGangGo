import { describe, expect, it } from 'vitest';

import {
  BUDDY_NUDGE_ACK_STATUSES,
  BUDDY_NUDGE_DAILY_LIMITS,
  BUDDY_NUDGE_TYPES,
  type AdvancedReportResponse,
  type ApiSuccessResponse,
  type DailyShareSnapshot,
  type TeamSnapshotsResponse,
  authResponseSchema,
  dailyReportSnapshotSchema,
  upsertDailyReportSnapshotsBulkRequestSchema,
  userProfileSchema,
} from '../index.js';

describe('contracts exports', () => {
  it('exports stable buddy nudge constants', () => {
    expect(BUDDY_NUDGE_TYPES).toEqual(['gentle', 'move', 'not_blank', 'habit_left', 'posture']);
    expect(BUDDY_NUDGE_ACK_STATUSES).toEqual(['received', 'later', 'done']);
    expect(BUDDY_NUDGE_DAILY_LIMITS).toEqual([0, 3, 5, 8]);
  });

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

  it('keeps daily share snapshots low-sensitivity', () => {
    const snapshot = {
      date: '2026-05-22',
      habitCompletion: 3,
      streakDays: 5,
      toiletRecorded: true,
      trainingDone: true,
    } satisfies DailyShareSnapshot;
    const response = {
      data: {
        date: snapshot.date,
        snapshots: [],
      },
    } satisfies ApiSuccessResponse<TeamSnapshotsResponse>;

    expect(response.data.date).toBe('2026-05-22');
    expect(Object.keys(snapshot)).toEqual(['date', 'habitCompletion', 'streakDays', 'toiletRecorded', 'trainingDone']);
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
        summary: {
          currentStreakDays: 3,
          habitFullDays: 1,
          hasAnyRecord: true,
          recordDays: 1,
          toiletLongMeetingCount: 0,
          toiletRecordDays: 1,
          trainingDays: 1,
        },
      },
    } satisfies ApiSuccessResponse<AdvancedReportResponse>;

    expect(response.data.range).toBe('90d');
    expect(response.data.days[0]?.habitCompletion).toBe(4);
  });
});

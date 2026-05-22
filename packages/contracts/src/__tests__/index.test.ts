import { describe, expect, it } from 'vitest';

import {
  BUDDY_NUDGE_ACK_STATUSES,
  BUDDY_NUDGE_DAILY_LIMITS,
  BUDDY_NUDGE_TYPES,
  type ApiSuccessResponse,
  type DailyShareSnapshot,
  type TeamSnapshotsResponse,
} from '../index.js';

describe('contracts exports', () => {
  it('exports stable buddy nudge constants', () => {
    expect(BUDDY_NUDGE_TYPES).toEqual(['gentle', 'move', 'not_blank', 'habit_left', 'posture']);
    expect(BUDDY_NUDGE_ACK_STATUSES).toEqual(['received', 'later', 'done']);
    expect(BUDDY_NUDGE_DAILY_LIMITS).toEqual([0, 3, 5, 8]);
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
    expect(Object.keys(snapshot)).toEqual([
      'date',
      'habitCompletion',
      'streakDays',
      'toiletRecorded',
      'trainingDone',
    ]);
  });
});

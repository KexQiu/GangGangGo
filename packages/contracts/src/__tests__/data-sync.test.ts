import { describe, expect, it } from 'vitest';

import {
  dailyActivitySummarySchema,
  dataSyncMutationSchema,
  dataSyncPushRequestSchema,
  friendHabitDataSchema,
  habitCheckInSyncPayloadSchema,
} from '../index.js';

const identity = {
  changedAt: '2026-07-21T08:00:00.000Z',
  entityId: 'record-1',
  mutationId: 'mutation-1',
  operation: 'upsert' as const,
};

describe('full data sync contracts', () => {
  it('preserves no bowel movement as a recorded state without treating it as a nutrition or activity level', () => {
    const payload = { date: '2026-09-29', bowel: 'not_today', water: 'low', fiber: 'medium', movement: 'good' };
    expect(habitCheckInSyncPayloadSchema.parse(payload)).toEqual(payload);
    expect(
      friendHabitDataSchema.parse({
        bowel: 'not_today',
        water: 'low',
        fiber: 'medium',
        movement: 'good',
        level: 'detailed',
        completionCount: 4,
        streakDays: 1,
      }),
    ).toMatchObject({ bowel: 'not_today', completionCount: 4 });
    for (const key of ['water', 'fiber', 'movement']) {
      expect(habitCheckInSyncPayloadSchema.safeParse({ ...payload, [key]: 'not_today' }).success).toBe(false);
    }
  });
  it('validates entity-specific payloads', () => {
    const request = {
      mutations: [
        {
          ...identity,
          entityType: 'training_session',
          payload: {
            completedRepetitions: 12,
            discomfortReported: false,
            durationSeconds: 120,
            endedAt: '2026-07-21T08:02:00.000Z',
            isCompleted: true,
            localDate: '2026-07-21',
            presetId: 'standard',
            startedAt: '2026-07-21T08:00:00.000Z',
          },
        },
      ],
      timeZone: 'Asia/Shanghai',
    };

    expect(dataSyncPushRequestSchema.safeParse(request).success).toBe(true);
    expect(
      dataSyncMutationSchema.safeParse({
        ...identity,
        entityType: 'habit_checkin',
        payload: request.mutations[0]?.payload,
      }).success,
    ).toBe(false);
  });

  it('requires null payloads for tombstones', () => {
    expect(
      dataSyncMutationSchema.safeParse({
        ...identity,
        entityType: 'toilet_session',
        operation: 'delete',
        payload: null,
      }).success,
    ).toBe(true);
    expect(
      dataSyncMutationSchema.safeParse({
        ...identity,
        entityType: 'toilet_session',
        operation: 'delete',
        payload: {},
      }).success,
    ).toBe(false);
  });

  it('validates the high-dimensional daily summary', () => {
    expect(
      dailyActivitySummarySchema.safeParse({
        date: '2026-07-21',
        habit: { bowel: 'good', completionCount: 4, fiber: 'good', movement: 'medium', water: 'good' },
        toilet: {
          attentionCount: 1,
          colorCounts: { normal: 1 },
          feelingCounts: { smooth: 1 },
          longSessionCount: 0,
          maxDurationSeconds: 360,
          medianDurationSeconds: 360,
          sessionCount: 1,
          shapeCounts: { formed: 1 },
          signalCounts: { 腹胀: 1 },
          totalDurationSeconds: 360,
        },
        training: { completedRepetitions: 12, completedSessionCount: 1, totalDurationSeconds: 120 },
      }).success,
    ).toBe(true);
  });

  it('defaults the maximum toilet duration for summaries written before the field existed', () => {
    const result = dailyActivitySummarySchema.safeParse({
      date: '2026-07-21',
      habit: { bowel: null, completionCount: 0, fiber: null, movement: null, water: null },
      toilet: {
        attentionCount: 0,
        colorCounts: {},
        feelingCounts: {},
        longSessionCount: 0,
        medianDurationSeconds: 0,
        sessionCount: 0,
        shapeCounts: {},
        signalCounts: {},
        totalDurationSeconds: 0,
      },
      training: { completedRepetitions: 0, completedSessionCount: 0, totalDurationSeconds: 0 },
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.toilet.maxDurationSeconds).toBe(0);
  });
});

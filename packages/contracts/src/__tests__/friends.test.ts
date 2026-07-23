import { describe, expect, it } from 'vitest';

import {
  friendDataResponseSchema,
  friendEventSchema,
  friendSettingsSchema,
  updateFriendSettingsRequestSchema,
} from '../index.js';

const NOW = '2026-07-22T08:00:00.000Z';
const FRIENDSHIP_ID = '00000000-0000-4000-8000-000000000010';
const USER_A = { avatarUrl: null, id: '00000000-0000-4000-8000-000000000001', nickname: '甲' };
const USER_B = { avatarUrl: null, id: '00000000-0000-4000-8000-000000000002', nickname: '乙' };

describe('friend contracts', () => {
  it('accepts privacy-first settings and all supported history windows', () => {
    const settings = {
      allowToiletEndNotificationsFromFriend: false,
      habitLevel: 'none',
      historyDays: 1,
      notifyFriendOnToiletEnd: false,
      nudgeDailyLimit: 5,
      nudgesEnabled: true,
      quietRanges: [],
      toiletLevel: 'none',
      trainingLevel: 'none',
    };

    expect(friendSettingsSchema.safeParse(settings).success).toBe(true);
    for (const historyDays of [1, 7, 30]) {
      expect(updateFriendSettingsRequestSchema.safeParse({ historyDays }).success).toBe(true);
    }
    expect(updateFriendSettingsRequestSchema.safeParse({}).success).toBe(false);
    expect(updateFriendSettingsRequestSchema.safeParse({ historyDays: 90 }).success).toBe(false);
  });

  it('keeps summary data free of detailed health fields', () => {
    const response = {
      days: [
        {
          date: '2026-07-22',
          habit: { completionCount: 3, level: 'summary', streakDays: 4 },
          toilet: { level: 'summary', toiletRecorded: true },
          training: { level: 'summary', trainingDone: true },
        },
      ],
      friend: USER_B,
      historyDays: 1,
    };

    expect(friendDataResponseSchema.safeParse(response).success).toBe(true);
    expect(
      friendDataResponseSchema.safeParse({
        ...response,
        days: [
          {
            ...response.days[0],
            toilet: { durationSeconds: 600, level: 'summary', toiletRecorded: true },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('supports manual reminders and privacy-trimmed toilet events', () => {
    expect(
      friendEventSchema.safeParse({
        ack: null,
        createdAt: NOW,
        expiresAt: '2026-07-23T08:00:00.000Z',
        friendshipId: FRIENDSHIP_ID,
        fromUser: USER_A,
        id: '00000000-0000-4000-8000-000000000020',
        kind: 'manual_nudge',
        message: '走两步',
        nudgeType: 'move',
        occurredAt: NOW,
        toUser: USER_B,
      }).success,
    ).toBe(true);
    expect(
      friendEventSchema.safeParse({
        createdAt: NOW,
        durationSeconds: null,
        friendshipId: FRIENDSHIP_ID,
        fromUser: USER_A,
        id: '00000000-0000-4000-8000-000000000021',
        kind: 'toilet_finished',
        occurredAt: NOW,
        toUser: USER_B,
      }).success,
    ).toBe(true);
  });
});

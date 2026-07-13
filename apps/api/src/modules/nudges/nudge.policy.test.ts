import { describe, expect, it } from 'vitest';

import type { BuddyNudge, BuddyNudgeAck } from '@xiaotidu/contracts';

import type { CurrentUser } from '../users/userTypes.js';
import { assertAckCanBeRevised, assertCanAcknowledge, assertDailyNudgeCountWithinLimit } from './nudge.policy.js';

const currentUser: CurrentUser = {
  appleUserId: 'nudge-policy-user',
  avatarUrl: null,
  id: 'user-1',
  nickname: '甲',
  timezone: 'Asia/Shanghai',
};

const nudge: BuddyNudge = {
  ack: null,
  createdAt: '2026-07-13T00:00:00.000Z',
  expiresAt: '2026-07-14T00:00:00.000Z',
  fromUser: { avatarUrl: null, id: 'user-2', nickname: '乙' },
  id: 'nudge-1',
  messageTemplate: '起来走两步。',
  teamId: 'team-1',
  toUser: { avatarUrl: null, id: currentUser.id, nickname: currentUser.nickname },
  type: 'move',
};

function ack(createdAt: string, revisionCount: 0 | 1): BuddyNudgeAck {
  return {
    createdAt,
    revisionCount,
    status: 'received',
    updatedAt: createdAt,
  };
}

describe('nudge policy', () => {
  it('only allows the recipient to acknowledge a nudge', () => {
    expect(() => assertCanAcknowledge(nudge, currentUser)).not.toThrow();
    expect(() => assertCanAcknowledge(nudge, { ...currentUser, id: 'user-3' })).toThrowError(
      '只能回复发给自己的提醒。',
    );
  });

  it('enforces the recipient daily limit boundary', () => {
    expect(() => assertDailyNudgeCountWithinLimit(5, 5)).not.toThrow();
    expect(() => assertDailyNudgeCountWithinLimit(6, 5)).toThrowError('今天已经轻轻戳够了，明天再来。');
  });

  it('allows exactly one acknowledgement revision within 30 minutes', () => {
    const now = new Date('2026-07-13T00:30:00.000Z');
    expect(() => assertAckCanBeRevised(ack('2026-07-13T00:00:01.000Z', 0), now)).not.toThrow();
    expect(() => assertAckCanBeRevised(ack('2026-07-13T00:00:01.000Z', 1), now)).toThrowError(
      '这条回执已经不能修改了。',
    );
    expect(() => assertAckCanBeRevised(ack('2026-07-13T00:00:00.000Z', 0), now)).toThrowError(
      '这条回执已经不能修改了。',
    );
    expect(() => assertAckCanBeRevised(null, now)).toThrowError('这条回执已经不能修改了。');
  });
});

import { describe, expect, it } from 'vitest';

import type { BuddyNudge, BuddyNudgeAckStatus, TeamMember } from '@xiaotidu/contracts';

import { toNudgeThreadSummaries } from './nudge.mapper.js';

const currentUser = {
  avatarUrl: null,
  id: '00000000-0000-4000-8000-000000000001',
  nickname: '我',
};
const buddy = {
  avatarUrl: null,
  id: '00000000-0000-4000-8000-000000000002',
  nickname: '搭子',
};
const members: TeamMember[] = [
  member(currentUser, 'owner'),
  member(buddy, 'buddy'),
];

describe('nudge thread summary mapper', () => {
  it.each([
    ['received', '收到'],
    ['later', '等会儿'],
    ['done', '已完成'],
  ] as const)('maps the %s ACK enum to its Chinese preview copy', (status, copy) => {
    const summaries = toNudgeThreadSummaries(currentUser.id, members, [nudgeWithAck(status)]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      latestPreview: `搭子：${copy}`,
      pendingCount: 0,
    });
  });
});

function member(user: typeof currentUser, role: TeamMember['role']): TeamMember {
  return {
    displayName: null,
    id: role === 'owner' ? '00000000-0000-4000-8000-000000000010' : '00000000-0000-4000-8000-000000000011',
    joinedAt: '2026-07-19T08:00:00.000Z',
    role,
    status: 'active',
    user,
  };
}

function nudgeWithAck(status: BuddyNudgeAckStatus): BuddyNudge {
  return {
    ack: {
      createdAt: '2026-07-19T08:05:00.000Z',
      revisionCount: 0,
      status,
      updatedAt: '2026-07-19T08:05:00.000Z',
    },
    createdAt: '2026-07-19T08:00:00.000Z',
    expiresAt: '2026-07-20T08:00:00.000Z',
    fromUser: currentUser,
    id: '00000000-0000-4000-8000-000000000100',
    messageTemplate: '起来走两步，给身体换个档。',
    teamId: '00000000-0000-4000-8000-000000000200',
    toUser: buddy,
    type: 'move',
  };
}

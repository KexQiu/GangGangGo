import { describe, expect, it } from 'vitest';

import type { BuddyNudge, NudgeThreadSummary } from '@xiaotidu/contracts';

import { getNudgeChatMessages, getNudgeHomeSummaryFromThreads, mergeNudges } from '../nudgeModel';

const currentUser = { avatarUrl: null, id: '00000000-0000-4000-8000-000000000001', nickname: '当前用户' };
const buddyUser = { avatarUrl: null, id: '00000000-0000-4000-8000-000000000002', nickname: '搭子' };

describe('nudge model', () => {
  it('deduplicates paginated nudges and keeps the latest acknowledgement', () => {
    const original = createNudge({ id: '00000000-0000-4000-8000-000000000010' });
    const acknowledged = createNudge({
      ack: {
        createdAt: '2026-07-13T08:01:00.000Z',
        revisionCount: 0,
        status: 'received',
        updatedAt: '2026-07-13T08:01:00.000Z',
      },
      id: original.id,
    });

    expect(mergeNudges([original, acknowledged])).toEqual([acknowledged]);
  });

  it('sorts chat messages chronologically and derives their direction', () => {
    const outgoing = createNudge({
      createdAt: '2026-07-13T08:02:00.000Z',
      fromUser: currentUser,
      id: '00000000-0000-4000-8000-000000000011',
      toUser: buddyUser,
    });
    const incoming = createNudge({ id: '00000000-0000-4000-8000-000000000012' });

    expect(getNudgeChatMessages({ currentUserId: currentUser.id, nudges: [outgoing, incoming] })).toEqual([
      expect.objectContaining({ direction: 'incoming', id: incoming.id }),
      expect.objectContaining({ direction: 'outgoing', id: outgoing.id }),
    ]);
  });

  it('selects the latest thread even when the API result is not sorted', () => {
    const threads = [
      createThread('2026-07-12T08:00:00.000Z', '较早消息', 2),
      createThread(null, '还没有互动', 0),
      createThread('2026-07-13T08:00:00.000Z', '最新消息', 1),
    ];

    expect(getNudgeHomeSummaryFromThreads(threads)).toEqual({
      latestAt: '2026-07-13T08:00:00.000Z',
      latestPreview: '最新消息',
      pendingCount: 3,
    });
  });
});

function createNudge(overrides: Partial<BuddyNudge> = {}): BuddyNudge {
  return {
    ack: null,
    createdAt: '2026-07-13T08:00:00.000Z',
    expiresAt: '2026-07-14T08:00:00.000Z',
    fromUser: buddyUser,
    id: '00000000-0000-4000-8000-000000000009',
    messageTemplate: '走两步',
    teamId: '00000000-0000-4000-8000-000000000003',
    toUser: currentUser,
    type: 'move',
    ...overrides,
  };
}

function createThread(latestAt: null | string, latestPreview: string, pendingCount: number): NudgeThreadSummary {
  return {
    buddy: buddyUser,
    latestAt,
    latestPreview,
    messageCount: 3,
    pendingCount,
    status: 'active',
  };
}

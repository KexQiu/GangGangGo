import type {
  BuddyNudge,
  BuddyNudgeAck,
  BuddyNudgeAckStatus,
  BuddyNudgeDailyLimit,
  BuddyNudgeSettings,
  NudgeThreadSummary,
  TeamMember,
} from '@xiaotidu/contracts';

import { defaultDailyLimit } from './nudge.policy.js';
import type { NudgeRecord } from './nudge.types.js';

const ackPreviewCopies: Record<BuddyNudgeAckStatus, string> = {
  done: '已完成',
  later: '等会儿',
  received: '收到',
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

export function toAck(input: {
  createdAt: Date | string;
  revisionCount: number;
  status: BuddyNudgeAckStatus;
  updatedAt: Date | string;
}): BuddyNudgeAck {
  return {
    createdAt: toIsoString(input.createdAt),
    revisionCount: input.revisionCount as 0 | 1,
    status: input.status,
    updatedAt: toIsoString(input.updatedAt),
  };
}

export function toNudge(record: NudgeRecord): BuddyNudge {
  return {
    ack: record.ack,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    fromUser: record.fromUser,
    id: record.id,
    messageTemplate: record.messageTemplate,
    teamId: record.teamId,
    toUser: record.toUser,
    type: record.type,
  };
}

export function toSettings(input: {
  buddyUserId: string;
  dailyLimit?: number;
  enabled?: boolean;
  quietRanges?: Array<{ end: string; start: string }>;
  teamId: string;
  userId: string;
}): BuddyNudgeSettings {
  return {
    buddyUserId: input.buddyUserId,
    dailyLimit: (input.dailyLimit ?? defaultDailyLimit) as BuddyNudgeDailyLimit,
    enabled: input.enabled ?? true,
    quietRanges: input.quietRanges ?? [],
    teamId: input.teamId,
    userId: input.userId,
  };
}

export function toNudgeThreadSummaries(
  currentUserId: string,
  members: TeamMember[],
  nudges: BuddyNudge[],
): NudgeThreadSummary[] {
  const threads = new Map<string, NudgeThreadSummary>();
  for (const member of members) {
    if (member.user.id === currentUserId || member.status === 'removed') continue;
    threads.set(member.user.id, {
      buddy: member.user,
      latestAt: null,
      latestPreview: '还没有互动，发个小暗号开始。',
      messageCount: 0,
      pendingCount: 0,
      status: member.status,
    });
  }

  for (const nudge of nudges) {
    const buddy = nudge.fromUser.id === currentUserId ? nudge.toUser : nudge.fromUser;
    const thread = threads.get(buddy.id);
    if (!thread) continue;
    thread.messageCount += 1;
    if (nudge.toUser.id === currentUserId && !nudge.ack) thread.pendingCount += 1;
    const latestAt = nudge.ack?.updatedAt ?? nudge.createdAt;
    if (!thread.latestAt || latestAt > thread.latestAt) {
      thread.latestAt = latestAt;
      thread.latestPreview = nudge.ack
        ? `${nudge.toUser.id === currentUserId ? '你' : (nudge.toUser.nickname ?? '搭子')}：${ackPreviewCopies[nudge.ack.status]}`
        : `${nudge.fromUser.id === currentUserId ? '你' : (nudge.fromUser.nickname ?? '搭子')}：${nudge.messageTemplate}`;
    }
  }

  return [...threads.values()].sort((left, right) => (right.latestAt ?? '').localeCompare(left.latestAt ?? ''));
}

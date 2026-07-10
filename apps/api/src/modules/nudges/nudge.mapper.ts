import type {
  BuddyNudge,
  BuddyNudgeAck,
  BuddyNudgeAckStatus,
  BuddyNudgeDailyLimit,
  BuddyNudgeSettings,
} from '@xiaotidu/contracts';

import { defaultDailyLimit } from './nudge.policy.js';
import type { NudgeRecord } from './nudge.types.js';

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

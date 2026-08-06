import type { FriendEvent, FriendSettings, UserSummary } from '@xiaotidu/contracts';

import { friendEventAcks, friendEvents, friendSettings, users } from '../../db/schema.js';
import { deserializeAvatarConfig } from '../users/avatarConfig.js';
import { defaultFriendSettings } from './friend.policy.js';

export type FriendSettingsRow = typeof friendSettings.$inferSelect;
type FriendEventRow = typeof friendEvents.$inferSelect;
type FriendAckRow = typeof friendEventAcks.$inferSelect;
type UserRow = typeof users.$inferSelect;

export function publicSettings(row: FriendSettingsRow | undefined): FriendSettings {
  if (!row) return defaultFriendSettings;
  return {
    allowToiletEndNotificationsFromFriend: row.allowToiletEndNotificationsFromFriend,
    habitLevel: row.habitLevel,
    historyDays: row.historyDays as FriendSettings['historyDays'],
    notifyFriendOnToiletEnd: row.notifyFriendOnToiletEnd,
    nudgeDailyLimit: row.nudgeDailyLimit as FriendSettings['nudgeDailyLimit'],
    nudgesEnabled: row.nudgesEnabled,
    quietRanges: row.quietRanges,
    toiletLevel: row.toiletLevel,
    trainingLevel: row.trainingLevel,
  };
}

export function toUserSummary(row: Pick<UserRow, 'avatarUrl' | 'id' | 'nickname'>): UserSummary {
  return {
    avatarUrl: deserializeAvatarConfig(row.avatarUrl),
    id: row.id,
    nickname: row.nickname,
  };
}

export function toAck(row: FriendAckRow) {
  return {
    createdAt: row.createdAt.toISOString(),
    revisionCount: row.revisionCount as 0 | 1,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toFriendEvent(input: {
  ack?: FriendAckRow;
  event: FriendEventRow;
  requesterId: string;
  settingsByOwner: Map<string, FriendSettingsRow>;
  usersById: Map<string, UserSummary>;
}): FriendEvent {
  const { event } = input;
  const fromUser = input.usersById.get(event.fromUserId);
  const toUser = input.usersById.get(event.toUserId);
  if (!fromUser || !toUser) throw new Error('Friend event contains a missing user.');
  const base = {
    createdAt: event.createdAt.toISOString(),
    friendshipId: event.friendshipId,
    fromUser,
    id: event.id,
    occurredAt: event.occurredAt.toISOString(),
    toUser,
  };
  if (event.kind === 'manual_nudge') {
    if (!event.expiresAt || !event.message || !event.nudgeType) throw new Error('Invalid manual friend nudge.');
    return {
      ...base,
      ack: input.ack ? toAck(input.ack) : null,
      expiresAt: event.expiresAt.toISOString(),
      kind: 'manual_nudge',
      message: event.message,
      nudgeType: event.nudgeType,
    };
  }
  const ownerSettings = input.settingsByOwner.get(event.fromUserId);
  const canSeeDuration = input.requesterId === event.fromUserId || ownerSettings?.toiletLevel === 'detailed';
  return {
    ...base,
    durationSeconds: canSeeDuration ? event.durationSeconds : null,
    kind: 'toilet_finished',
  };
}

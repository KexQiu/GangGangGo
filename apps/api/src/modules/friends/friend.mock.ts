import { randomUUID } from 'node:crypto';

import type { FriendEvent, FriendResponse, FriendSettings, FriendSummary } from '@xiaotidu/contracts';

import { ApiError } from '../../http/apiError.js';
import type { PushNotificationService } from '../push/pushNotificationService.js';
import { createNoopPushNotificationService } from '../push/pushNotificationService.js';
import type { CurrentUser } from '../users/userTypes.js';
import {
  ackNotificationMessages,
  ackRevisionWindowMs,
  createInviteToken,
  createInviteUrl,
  dateKeyInTimezone,
  dateRange,
  defaultFriendSettings,
  emptySummary,
  ensureInviteUsable,
  friendLimit,
  inviteTtlMs,
  isInQuietRanges,
  notifySafely,
  nudgeMessages,
  nudgeTtlMs,
  parseEventCursor,
  projectDay,
} from './friend.policy.js';
import type { FriendService } from './friend.types.js';

type MockFriendship = {
  createdAt: Date;
  id: string;
  settings: Map<string, FriendSettings & { allowEnabledAt: Date | null; notifyEnabledAt: Date | null }>;
  toiletEventSourceIds: Set<string>;
  users: [CurrentUser, CurrentUser];
};

export function createMockFriendService(
  options: { pushNotificationService?: PushNotificationService } = {},
): FriendService {
  const pushNotificationService = options.pushNotificationService ?? createNoopPushNotificationService();
  const invites = new Map<string, { acceptedAt: Date | null; expiresAt: Date; id: string; inviter: CurrentUser }>();
  const friendshipRows = new Map<string, MockFriendship>();
  const events = new Map<string, FriendEvent[]>();
  const nudgeCounters = new Map<string, number>();

  function findMockFriendship(userId: string, friendUserId: string) {
    return [...friendshipRows.values()].find(
      (row) => row.users.some((user) => user.id === userId) && row.users.some((user) => user.id === friendUserId),
    );
  }

  function requireMockFriendship(userId: string, friendUserId: string) {
    const row = findMockFriendship(userId, friendUserId);
    if (!row) throw new ApiError(404, 'not_found', '没有找到这个好友。');
    return row;
  }

  function mockSummary(row: MockFriendship, currentUser: CurrentUser): FriendSummary {
    const friend = row.users.find((user) => user.id !== currentUser.id)!;
    const thread = events.get(row.id) ?? [];
    const settings = row.settings.get(friend.id) ?? {
      ...defaultFriendSettings,
      allowEnabledAt: null,
      notifyEnabledAt: null,
    };
    return {
      createdAt: row.createdAt.toISOString(),
      dataPreview: {
        date: dateKeyInTimezone(friend.timezone),
        habitCompletion: settings.habitLevel === 'none' ? null : 0,
        streakDays: settings.habitLevel === 'none' ? null : 0,
        toiletRecorded: settings.toiletLevel === 'none' ? null : false,
        trainingDone: settings.trainingLevel === 'none' ? null : false,
      },
      friend,
      friendshipId: row.id,
      latestEvent: thread[0] ? projectMockEvent(thread[0], row, currentUser.id) : null,
      pendingCount: thread.filter(
        (event) =>
          event.kind === 'manual_nudge' &&
          event.toUser.id === currentUser.id &&
          !event.ack &&
          new Date(event.expiresAt).getTime() > Date.now(),
      ).length,
    };
  }

  async function getFriend(currentUser: CurrentUser, friendUserId: string): Promise<FriendResponse> {
    const row = requireMockFriendship(currentUser.id, friendUserId);
    const friend = row.users.find((user) => user.id === friendUserId)!;
    const mySettings = row.settings.get(currentUser.id) ?? {
      ...defaultFriendSettings,
      allowEnabledAt: null,
      notifyEnabledAt: null,
    };
    const friendOwnedSettings = row.settings.get(friendUserId) ?? {
      ...defaultFriendSettings,
      allowEnabledAt: null,
      notifyEnabledAt: null,
    };
    return {
      friend: {
        ...mockSummary(row, currentUser),
        friend,
        friendSettings: publicMockSettings(friendOwnedSettings),
        mySettings: publicMockSettings(mySettings),
        toiletNotificationsActive:
          mySettings.notifyFriendOnToiletEnd && friendOwnedSettings.allowToiletEndNotificationsFromFriend,
      },
    };
  }

  return {
    async acceptInvite(currentUser, token) {
      const invite = invites.get(token);
      if (!invite) throw new ApiError(404, 'not_found', '没有找到这个好友邀请。');
      ensureInviteUsable({ ...invite, revokedAt: null });
      if (invite.inviter.id === currentUser.id) throw new ApiError(400, 'bad_request', '不能接受自己的好友邀请。');
      if (findMockFriendship(invite.inviter.id, currentUser.id))
        throw new ApiError(409, 'conflict', '你们已经是好友了。');
      const counts = [invite.inviter.id, currentUser.id].map(
        (userId) => [...friendshipRows.values()].filter((row) => row.users.some((user) => user.id === userId)).length,
      );
      if (counts.some((count) => count >= friendLimit)) {
        throw new ApiError(409, 'conflict', '好友数量已经达到 20 人上限。');
      }
      invite.acceptedAt = new Date();
      const id = randomUUID();
      friendshipRows.set(id, {
        createdAt: new Date(),
        id,
        settings: new Map([
          [invite.inviter.id, { ...defaultFriendSettings, allowEnabledAt: null, notifyEnabledAt: null }],
          [currentUser.id, { ...defaultFriendSettings, allowEnabledAt: null, notifyEnabledAt: null }],
        ]),
        toiletEventSourceIds: new Set(),
        users: [invite.inviter, currentUser],
      });
      return getFriend(currentUser, invite.inviter.id);
    },
    async ackNudge(currentUser, eventId, status) {
      const event = [...events.values()].flat().find((item) => item.id === eventId);
      if (!event || event.kind !== 'manual_nudge') throw new ApiError(404, 'not_found', '没有找到这条好友提醒。');
      if (event.toUser.id !== currentUser.id) throw new ApiError(403, 'forbidden', '只能回复发给自己的提醒。');
      if (new Date(event.expiresAt).getTime() <= Date.now()) {
        throw new ApiError(409, 'conflict', '这条好友提醒已经过期。');
      }
      const now = new Date().toISOString();
      if (event.ack?.status === status) return { ack: event.ack };
      if (
        event.ack &&
        (event.ack.revisionCount >= 1 || new Date(event.ack.createdAt).getTime() <= Date.now() - ackRevisionWindowMs)
      ) {
        throw new ApiError(409, 'conflict', '这条回执已经不能修改了。');
      }
      event.ack = {
        createdAt: event.ack?.createdAt ?? now,
        revisionCount: event.ack ? 1 : 0,
        status,
        updatedAt: now,
      };
      await notifySafely(pushNotificationService, {
        body: ackNotificationMessages[status],
        data: { eventId, friendUserId: currentUser.id, kind: 'friend-nudge-ack', status },
        title: '好友有回音了',
        userId: event.fromUser.id,
      });
      return { ack: event.ack };
    },
    async createInvite(currentUser) {
      const count = [...friendshipRows.values()].filter((row) =>
        row.users.some((user) => user.id === currentUser.id),
      ).length;
      if (count >= friendLimit) throw new ApiError(409, 'conflict', '好友数量已经达到 20 人上限。');
      const token = createInviteToken();
      const invite = {
        acceptedAt: null,
        expiresAt: new Date(Date.now() + inviteTtlMs),
        id: randomUUID(),
        inviter: currentUser,
      };
      invites.set(token, invite);
      return {
        expiresAt: invite.expiresAt.toISOString(),
        inviteId: invite.id,
        inviteUrl: createInviteUrl(token),
        token,
      };
    },
    async deleteFriend(currentUser, friendUserId) {
      const row = requireMockFriendship(currentUser.id, friendUserId);
      friendshipRows.delete(row.id);
      events.delete(row.id);
      for (const key of nudgeCounters.keys()) {
        if (
          key.startsWith(`${currentUser.id}:${friendUserId}:`) ||
          key.startsWith(`${friendUserId}:${currentUser.id}:`)
        ) {
          nudgeCounters.delete(key);
        }
      }
    },
    getFriend,
    async getFriendData(currentUser, friendUserId) {
      const row = requireMockFriendship(currentUser.id, friendUserId);
      const friend = row.users.find((user) => user.id === friendUserId)!;
      const settings = row.settings.get(friendUserId) ?? {
        ...defaultFriendSettings,
        allowEnabledAt: null,
        notifyEnabledAt: null,
      };
      const dates = dateRange(dateKeyInTimezone(friend.timezone), settings.historyDays);
      return {
        days: dates.map((date) => projectDay(emptySummary(date), settings, 0)),
        friend,
        historyDays: settings.historyDays,
      };
    },
    async listEvents(currentUser, friendUserId, options) {
      const row = requireMockFriendship(currentUser.id, friendUserId);
      const cursor = parseEventCursor(options.before);
      const all = (events.get(row.id) ?? []).filter((event) => {
        if (!cursor) return true;
        const occurredAt = new Date(event.occurredAt);
        return (
          occurredAt < cursor.occurredAt ||
          (occurredAt.getTime() === cursor.occurredAt.getTime() && event.id < cursor.id)
        );
      });
      const page = all.slice(0, options.limit);
      return {
        events: page.map((event) => projectMockEvent(event, row, currentUser.id)),
        hasMore: all.length > options.limit,
        nextCursor:
          all.length > options.limit && page.at(-1)
            ? Buffer.from(`${page.at(-1)!.occurredAt}\n${page.at(-1)!.id}`).toString('base64url')
            : null,
      };
    },
    async listFriends(currentUser) {
      return {
        friends: [...friendshipRows.values()]
          .filter((row) => row.users.some((user) => user.id === currentUser.id))
          .map((row) => mockSummary(row, currentUser)),
      };
    },
    async previewInvite(token) {
      const invite = invites.get(token);
      if (!invite) throw new ApiError(404, 'not_found', '没有找到这个好友邀请。');
      ensureInviteUsable({ ...invite, revokedAt: null });
      return { expiresAt: invite.expiresAt.toISOString(), inviter: invite.inviter };
    },
    async recordToiletFinished(currentUser, event) {
      for (const row of friendshipRows.values()) {
        if (!row.users.some((user) => user.id === currentUser.id)) continue;
        const recipient = row.users.find((user) => user.id !== currentUser.id)!;
        const senderSettings = row.settings.get(currentUser.id)!;
        const recipientSettings = row.settings.get(recipient.id)!;
        const endedAt = new Date(event.endedAt);
        if (
          !senderSettings.notifyFriendOnToiletEnd ||
          !recipientSettings.allowToiletEndNotificationsFromFriend ||
          !senderSettings.notifyEnabledAt ||
          !recipientSettings.allowEnabledAt ||
          Number.isNaN(endedAt.getTime()) ||
          endedAt < senderSettings.notifyEnabledAt ||
          endedAt < recipientSettings.allowEnabledAt
        ) {
          continue;
        }
        const thread = events.get(row.id) ?? [];
        const sourceKey = `${currentUser.id}:${recipient.id}:${event.sourceEntityId}`;
        if (row.toiletEventSourceIds.has(sourceKey)) continue;
        row.toiletEventSourceIds.add(sourceKey);
        const created: FriendEvent = {
          createdAt: new Date().toISOString(),
          durationSeconds: event.durationSeconds,
          friendshipId: row.id,
          fromUser: currentUser,
          id: randomUUID(),
          kind: 'toilet_finished',
          occurredAt: event.endedAt,
          toUser: recipient,
        };
        events.set(row.id, [created, ...thread]);
        if (!isInQuietRanges(recipientSettings.quietRanges, recipient.timezone)) {
          const nickname = currentUser.nickname ?? '你的好友';
          await notifySafely(pushNotificationService, {
            body:
              senderSettings.toiletLevel === 'detailed'
                ? `${nickname}刚结束蹲会儿，本次 ${Math.max(1, Math.round(event.durationSeconds / 60))} 分钟。`
                : `${nickname}刚结束蹲会儿。`,
            data: { eventId: created.id, friendUserId: currentUser.id, kind: 'friend-toilet-finished' },
            title: '好友刚收工',
            userId: recipient.id,
          });
        }
      }
    },
    async sendNudge(currentUser, friendUserId, input) {
      const row = requireMockFriendship(currentUser.id, friendUserId);
      const friend = row.users.find((user) => user.id === friendUserId)!;
      const recipientSettings = row.settings.get(friendUserId)!;
      if (!recipientSettings.nudgesEnabled || recipientSettings.nudgeDailyLimit === 0) {
        throw new ApiError(403, 'forbidden', '这个好友暂时关闭了主动提醒。');
      }
      if (isInQuietRanges(recipientSettings.quietRanges, friend.timezone)) {
        throw new ApiError(403, 'forbidden', '现在是好友的免打扰时间。');
      }
      const now = new Date();
      const counterKey = `${currentUser.id}:${friendUserId}:${dateKeyInTimezone(friend.timezone, now)}`;
      const count = (nudgeCounters.get(counterKey) ?? 0) + 1;
      if (count > recipientSettings.nudgeDailyLimit) {
        throw new ApiError(429, 'rate_limited', '今天已经轻轻戳够了，明天再来。');
      }
      nudgeCounters.set(counterKey, count);
      const created: FriendEvent = {
        ack: null,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + nudgeTtlMs).toISOString(),
        friendshipId: row.id,
        fromUser: currentUser,
        id: randomUUID(),
        kind: 'manual_nudge',
        message: nudgeMessages[input.type],
        nudgeType: input.type,
        occurredAt: now.toISOString(),
        toUser: friend,
      };
      events.set(row.id, [created, ...(events.get(row.id) ?? [])]);
      await notifySafely(pushNotificationService, {
        body: created.message,
        data: { eventId: created.id, friendUserId: currentUser.id, kind: 'friend-nudge', type: input.type },
        title: '好友轻轻戳了你一下',
        userId: friendUserId,
      });
      return created;
    },
    async updateSettings(currentUser, friendUserId, input) {
      const row = requireMockFriendship(currentUser.id, friendUserId);
      const current = row.settings.get(currentUser.id)!;
      const now = new Date();
      row.settings.set(currentUser.id, {
        ...current,
        ...input,
        allowEnabledAt:
          input.allowToiletEndNotificationsFromFriend === undefined
            ? current.allowEnabledAt
            : input.allowToiletEndNotificationsFromFriend
              ? (current.allowEnabledAt ?? now)
              : null,
        notifyEnabledAt:
          input.notifyFriendOnToiletEnd === undefined
            ? current.notifyEnabledAt
            : input.notifyFriendOnToiletEnd
              ? (current.notifyEnabledAt ?? now)
              : null,
      });
      return getFriend(currentUser, friendUserId);
    },
  };
}

function publicMockSettings(
  settings: FriendSettings & { allowEnabledAt: Date | null; notifyEnabledAt: Date | null },
): FriendSettings {
  const { allowEnabledAt: _allowEnabledAt, notifyEnabledAt: _notifyEnabledAt, ...publicValues } = settings;
  return publicValues;
}

function projectMockEvent(event: FriendEvent, row: MockFriendship, requesterId: string): FriendEvent {
  if (event.kind !== 'toilet_finished') return event;
  const ownerSettings = row.settings.get(event.fromUser.id);
  return {
    ...event,
    durationSeconds:
      requesterId === event.fromUser.id || ownerSettings?.toiletLevel === 'detailed' ? event.durationSeconds : null,
  };
}

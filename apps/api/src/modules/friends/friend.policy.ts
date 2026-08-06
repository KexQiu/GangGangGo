import { createHash, randomBytes } from 'node:crypto';

import type {
  CreateFriendNudgeRequest,
  DailyActivitySummary,
  FriendNudgeAckStatus,
  FriendSettings,
  FriendSharedDay,
} from '@xiaotidu/contracts';

import { ApiError } from '../../http/apiError.js';
import type { PushNotificationService } from '../push/pushNotificationService.js';

export const friendLimit = 20;
export const inviteTtlMs = 7 * 24 * 60 * 60 * 1000;
export const nudgeTtlMs = 24 * 60 * 60 * 1000;
export const ackRevisionWindowMs = 30 * 60 * 1000;
export const trainingTarget = 2;
const defaultTimezone = 'Asia/Shanghai';

export const nudgeMessages: Record<CreateFriendNudgeRequest['type'], string> = {
  gentle: '轻轻戳一下，今天别空白。',
  habit_left: '小账本还差一笔，顺手把今天补完整。',
  move: '起来走两步，给身体换个档。',
  not_blank: '今天留一点小进展，哪怕很小也算数。',
  posture: '肩颈松一下，别把自己拧住。',
};

export const ackNotificationMessages: Record<FriendNudgeAckStatus, string> = {
  done: '对方说已完成。',
  later: '对方说等会儿。',
  received: '对方说收到了。',
};

export const defaultFriendSettings: FriendSettings = {
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

export function canonicalPair(left: string, right: string) {
  return left.localeCompare(right) < 0
    ? { lowerUserId: left, upperUserId: right }
    : { lowerUserId: right, upperUserId: left };
}

export function otherUserId(friendship: { lowerUserId: string; upperUserId: string }, userId: string) {
  return friendship.lowerUserId === userId ? friendship.upperUserId : friendship.lowerUserId;
}

export function settingsKey(friendshipId: string, userId: string) {
  return `${friendshipId}:${userId}`;
}

export function dateKeyInTimezone(timezone: string | null | undefined, now = new Date()) {
  try {
    const values = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone || defaultTimezone,
        year: 'numeric',
      })
        .formatToParts(now)
        .map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function addDays(date: string, amount: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year!, month! - 1, day! + amount));
  return value.toISOString().slice(0, 10);
}

export function dateRange(endedAt: string, days: number) {
  return Array.from({ length: days }, (_, index) => addDays(endedAt, index - days + 1));
}

export function calculateHabitStreak(
  summariesByUserDate: Map<string, DailyActivitySummary>,
  userId: string,
  endedAt: string,
) {
  let streak = 0;
  for (const date of dateRange(endedAt, 90)) {
    streak = summariesByUserDate.get(`${userId}:${date}`)?.habit.completionCount === 4 ? streak + 1 : 0;
  }
  return streak;
}

export function isInQuietRanges(ranges: FriendSettings['quietRanges'], timezone: string, now = new Date()) {
  let parts: Record<string, string>;
  try {
    parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        hour12: false,
        minute: '2-digit',
        timeZone: timezone,
      })
        .formatToParts(now)
        .map((part) => [part.type, part.value]),
    );
  } catch {
    return false;
  }
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  return ranges.some((range) => {
    const [startHour, startMinute] = range.start.split(':').map(Number);
    const [endHour, endMinute] = range.end.split(':').map(Number);
    const start = startHour! * 60 + startMinute!;
    const end = endHour! * 60 + endMinute!;
    if (start === end) return true;
    return start < end ? current >= start && current < end : current >= start || current < end;
  });
}

export async function notifySafely(
  service: PushNotificationService,
  payload: Parameters<PushNotificationService['sendToUser']>[0],
) {
  try {
    await service.sendToUser(payload);
  } catch {
    // 应用内事件是事实源；推送失败不能回滚领域状态。
  }
}

export function createInviteToken() {
  return randomBytes(24).toString('base64url');
}

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createInviteUrl(token: string) {
  return `xiaotidu://friend/join/${token}`;
}

export function ensureInviteUsable(invite: { acceptedAt: Date | null; expiresAt: Date; revokedAt: Date | null }) {
  if (invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(404, 'not_found', '这个好友邀请已经失效。');
  }
  if (invite.acceptedAt) throw new ApiError(409, 'conflict', '这个好友邀请已经被使用过了。');
}

export function encodeEventCursor(event: { id: string; occurredAt: Date }) {
  return Buffer.from(`${event.occurredAt.toISOString()}\n${event.id}`).toString('base64url');
}

export function parseEventCursor(value: string | undefined) {
  if (!value) return null;
  try {
    const [occurredAtValue, id, ...rest] = Buffer.from(value, 'base64url').toString('utf8').split('\n');
    const occurredAt = new Date(occurredAtValue ?? '');
    if (
      rest.length > 0 ||
      Number.isNaN(occurredAt.getTime()) ||
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ) {
      throw new Error('invalid cursor');
    }
    return { id, occurredAt };
  } catch {
    throw new ApiError(400, 'bad_request', '好友互动游标无效。');
  }
}

export function emptySummary(date: string): DailyActivitySummary {
  return {
    date,
    habit: { bowel: null, completionCount: 0, fiber: null, movement: null, water: null },
    toilet: {
      attentionCount: 0,
      colorCounts: {},
      feelingCounts: {},
      longSessionCount: 0,
      maxDurationSeconds: 0,
      medianDurationSeconds: 0,
      sessionCount: 0,
      shapeCounts: {},
      signalCounts: {},
      totalDurationSeconds: 0,
    },
    training: { completedRepetitions: 0, completedSessionCount: 0, totalDurationSeconds: 0 },
  };
}

export function projectDay(
  summary: DailyActivitySummary,
  settings: FriendSettings,
  streakDays: number,
): FriendSharedDay {
  const trainingDone = summary.training.completedSessionCount >= trainingTarget;
  const toiletRecorded = summary.toilet.sessionCount > 0;
  return {
    date: summary.date,
    habit:
      settings.habitLevel === 'none'
        ? { level: 'none' }
        : settings.habitLevel === 'summary'
          ? { completionCount: summary.habit.completionCount, level: 'summary', streakDays }
          : { ...summary.habit, level: 'detailed', streakDays },
    toilet:
      settings.toiletLevel === 'none'
        ? { level: 'none' }
        : settings.toiletLevel === 'summary'
          ? { level: 'summary', toiletRecorded }
          : { ...summary.toilet, level: 'detailed', toiletRecorded },
    training:
      settings.trainingLevel === 'none'
        ? { level: 'none' }
        : settings.trainingLevel === 'summary'
          ? { level: 'summary', trainingDone }
          : { ...summary.training, level: 'detailed', trainingDone },
  };
}

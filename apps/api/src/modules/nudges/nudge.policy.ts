import type {
  BuddyNudge,
  BuddyNudgeAck,
  BuddyNudgeAckStatus,
  BuddyNudgeDailyLimit,
  BuddyNudgeSettings,
  BuddyNudgeType,
  Team,
} from '@xiaotidu/contracts';

import { ApiError } from '../../http/apiError.js';
import type { PushNotificationService } from '../push/pushNotificationService.js';
import type { CurrentUser } from '../users/userTypes.js';

export const defaultDailyLimit: BuddyNudgeDailyLimit = 5;
export const defaultTimezone = 'Asia/Shanghai';
export const nudgeTtlMs = 24 * 60 * 60 * 1000;
export const ackRevisionWindowMs = 30 * 60 * 1000;

export const nudgeMessages: Record<BuddyNudgeType, string> = {
  gentle: '轻轻戳一下，今天别空白。',
  habit_left: '小账本还差一笔，顺手把今天补完整。',
  move: '起来走两步，给身体换个档。',
  not_blank: '今天留一点小进展，哪怕很小也算数。',
  posture: '肩颈松一下，别把自己拧住。',
};

export const ackNotificationMessages: Record<BuddyNudgeAckStatus, string> = {
  done: '对方说已完成。',
  later: '对方说等会儿。',
  received: '对方说收到了。',
};

function parseTimeToMinutes(time: string) {
  const [hour = '0', minute = '0'] = time.split(':');
  return Number(hour) * 60 + Number(minute);
}

function getTimezoneParts(timezone: string, now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    month: Number(values.month),
    second: Number(values.second),
    year: Number(values.year),
  };
}

function getSafeTimezoneParts(timezone: string | null | undefined, now: Date) {
  try {
    return getTimezoneParts(timezone || defaultTimezone, now);
  } catch {
    return getTimezoneParts(defaultTimezone, now);
  }
}

function getTimezoneOffsetMs(timezone: string | null | undefined, date: Date) {
  const parts = getSafeTimezoneParts(timezone, date);
  const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  return zonedAsUtc - date.getTime();
}

function isInQuietRanges(
  quietRanges: Array<{ end: string; start: string }>,
  timezone: string | null | undefined,
  now = new Date(),
) {
  const parts = getSafeTimezoneParts(timezone, now);
  const currentMinutes = parts.hour * 60 + parts.minute;

  return quietRanges.some((range) => {
    const startMinutes = parseTimeToMinutes(range.start);
    const endMinutes = parseTimeToMinutes(range.end);

    if (startMinutes === endMinutes) {
      return true;
    }

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  });
}

export function todayStartInTimezone(timezone: string | null | undefined, now = new Date()) {
  const parts = getSafeTimezoneParts(timezone, now);
  const localMidnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const timezoneOffsetMs = getTimezoneOffsetMs(timezone, new Date(localMidnightAsUtc));

  return new Date(localMidnightAsUtc - timezoneOffsetMs);
}

export function todayDateKeyInTimezone(timezone: string | null | undefined, now = new Date()) {
  const parts = getSafeTimezoneParts(timezone, now);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function assertCanNudge(input: {
  currentUser: CurrentUser;
  recipientTimezone?: string | null;
  settings: BuddyNudgeSettings;
  team: Team;
  toUserId: string;
  todayCount: number;
}) {
  if (input.currentUser.id === input.toUserId) {
    throw new ApiError(400, 'bad_request', '不能戳自己。');
  }

  const fromMember = input.team.members.find((member) => member.user.id === input.currentUser.id);
  const toMember = input.team.members.find((member) => member.user.id === input.toUserId);

  if (!fromMember || !toMember) {
    throw new ApiError(403, 'forbidden', '只能提醒同一个小队里的搭子。');
  }

  if (fromMember.status !== 'active' || toMember.status !== 'active') {
    throw new ApiError(403, 'forbidden', '搭子暂时不接收提醒。');
  }

  if (!input.settings.enabled || input.settings.dailyLimit === 0) {
    throw new ApiError(403, 'forbidden', '这个搭子暂时关闭了主动提醒。');
  }

  if (isInQuietRanges(input.settings.quietRanges, input.recipientTimezone)) {
    throw new ApiError(403, 'forbidden', '现在是搭子的免打扰时间。');
  }

  if (input.todayCount >= input.settings.dailyLimit) {
    throw new ApiError(429, 'rate_limited', '今天已经轻轻戳够了，明天再来。');
  }
}

export function assertCanAcknowledge(nudge: BuddyNudge, currentUser: CurrentUser) {
  if (nudge.toUser.id !== currentUser.id) {
    throw new ApiError(403, 'forbidden', '只能回复发给自己的提醒。');
  }
}

export function assertDailyNudgeCountWithinLimit(count: number, dailyLimit: BuddyNudgeDailyLimit) {
  if (count > dailyLimit) {
    throw new ApiError(429, 'rate_limited', '今天已经轻轻戳够了，明天再来。');
  }
}

export function assertAckCanBeRevised(ack: BuddyNudgeAck | null, now = new Date()) {
  const createdAt = ack ? new Date(ack.createdAt) : null;

  if (!ack || ack.revisionCount >= 1 || !createdAt || createdAt.getTime() <= now.getTime() - ackRevisionWindowMs) {
    throw new ApiError(409, 'conflict', '这条回执已经不能修改了。');
  }
}

export function requireCurrentTeam(team: Team | null): Team {
  if (!team) {
    throw new ApiError(404, 'not_found', '还没有小队。');
  }

  return team;
}

export function requireBuddyMember(team: Team, currentUser: CurrentUser, buddyUserId: string) {
  const currentMember = team.members.find((member) => member.user.id === currentUser.id);
  const buddyMember = team.members.find((member) => member.user.id === buddyUserId);

  if (!currentMember || !buddyMember || currentUser.id === buddyUserId) {
    throw new ApiError(404, 'not_found', '没有找到这个搭子。');
  }

  return buddyMember;
}

export async function notifySafely(
  pushNotificationService: PushNotificationService,
  payload: Parameters<PushNotificationService['sendToUser']>[0],
) {
  try {
    await pushNotificationService.sendToUser(payload);
  } catch {
    // Push delivery should not make the core nudge flow fail.
  }
}

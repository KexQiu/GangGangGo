import { type ReminderKind, type ReminderSettings } from './reminderTypes';

export const DEFAULT_KEGEL_TIMES = ['09:30', '14:30', '20:30'];
export const DEFAULT_QUIET_HOURS_END = '08:30';
export const DEFAULT_QUIET_HOURS_START = '22:30';
export const SEDENTARY_INTERVAL_OPTIONS = [45, 60, 90] as const;

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_ACTIVE_START_MINUTES = 9 * 60;
const DEFAULT_ACTIVE_END_MINUTES = 21 * 60;
const SEDENTARY_SCHEDULE_DAYS = 2;
const MAX_SEDENTARY_NOTIFICATIONS = 40;

export const defaultReminderSettings: ReminderSettings = {
  kegelEnabled: false,
  kegelTimes: DEFAULT_KEGEL_TIMES.slice(0, 2),
  privacyMode: true,
  quietHoursEnd: DEFAULT_QUIET_HOURS_END,
  quietHoursStart: DEFAULT_QUIET_HOURS_START,
  sedentaryEnabled: false,
  sedentaryIntervalMinutes: 60,
  updatedAt: new Date(0).toISOString(),
};

export function normalizeReminderSettings(settings: ReminderSettings): ReminderSettings {
  const kegelTimes = settings.kegelTimes
    .filter(isReminderTime)
    .slice(0, DEFAULT_KEGEL_TIMES.length);

  return {
    ...settings,
    kegelTimes: kegelTimes.length > 0 ? kegelTimes : defaultReminderSettings.kegelTimes,
    quietHoursEnd: isReminderTime(settings.quietHoursEnd)
      ? settings.quietHoursEnd
      : defaultReminderSettings.quietHoursEnd,
    quietHoursStart: isReminderTime(settings.quietHoursStart)
      ? settings.quietHoursStart
      : defaultReminderSettings.quietHoursStart,
    sedentaryIntervalMinutes: normalizeSedentaryInterval(settings.sedentaryIntervalMinutes),
  };
}

export function getKegelTimesForCount(count: number): string[] {
  return DEFAULT_KEGEL_TIMES.slice(0, Math.max(1, Math.min(count, DEFAULT_KEGEL_TIMES.length)));
}

export function hasAnyReminderEnabled(settings: ReminderSettings): boolean {
  return settings.kegelEnabled || settings.sedentaryEnabled;
}

export function getQuietHoursLabel(settings: ReminderSettings): string {
  if (isQuietHoursDisabled(settings)) {
    return '关闭';
  }

  return `${settings.quietHoursStart} - ${settings.quietHoursEnd}`;
}

export function getKegelReminderTimesOutsideQuietHours(settings: ReminderSettings): string[] {
  return settings.kegelTimes.filter(
    (time) => !isTimeInQuietHours(time, settings.quietHoursStart, settings.quietHoursEnd),
  );
}

export function getNextKegelReminderTime(settings: ReminderSettings, now = new Date()): string | null {
  if (!settings.kegelEnabled) {
    return null;
  }

  const availableTimes = getKegelReminderTimesOutsideQuietHours(settings).sort();
  if (availableTimes.length === 0) {
    return null;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return availableTimes.find((time) => {
    const reminderMinutes = parseTimeToMinutes(time);
    return reminderMinutes !== null && reminderMinutes > currentMinutes;
  }) ?? availableTimes[0];
}

export function getReminderHomeSummary(settings: ReminderSettings, now = new Date()) {
  if (!hasAnyReminderEnabled(settings)) {
    return {
      subtitle: '开启后只用小暗号提醒，不在通知栏大声广播。',
      title: '小暗号还没开',
    };
  }

  const nextKegelTime = getNextKegelReminderTime(settings, now);
  if (settings.kegelEnabled && nextKegelTime) {
    return {
      subtitle: settings.privacyMode
        ? `下一次小花营业 ${nextKegelTime}`
        : `下一次菊花抬 ${nextKegelTime}`,
      title: settings.privacyMode ? '小暗号已开启' : '菊花抬已安排',
    };
  }

  if (settings.sedentaryEnabled) {
    return {
      subtitle: `每 ${settings.sedentaryIntervalMinutes} 分钟提醒身体换个姿势`,
      title: settings.privacyMode ? '动一动暗号已开启' : '久坐提醒已安排',
    };
  }

  return {
    subtitle: '提醒都撞上勿扰时间了，换个时段就能开工。',
    title: '暗号暂时发不出去',
  };
}

export function getReminderCopy(kind: ReminderKind, privacyMode: boolean) {
  if (kind === 'kegel') {
    return privacyMode
      ? {
          body: '1 分钟，暗号已到。',
          title: '小花营业时间',
        }
      : {
          body: '轻提轻放，1 分钟就好。',
          title: '菊花抬时间',
        };
  }

  return privacyMode
    ? {
        body: '站起来晃一晃，别让身体坐成定格画面。',
        title: '换个姿势',
      }
    : {
        body: '离座 1 分钟，今天就算赚到。',
        title: '久坐暂停',
      };
}

export function buildSedentaryReminderDates(settings: ReminderSettings, now = new Date()): Date[] {
  if (!settings.sedentaryEnabled) {
    return [];
  }

  const dates: Date[] = [];
  const windows = getActiveMinuteWindows(settings);
  const interval = normalizeSedentaryInterval(settings.sedentaryIntervalMinutes);

  for (let dayOffset = 0; dayOffset < SEDENTARY_SCHEDULE_DAYS; dayOffset += 1) {
    for (const [windowStart, windowEnd] of windows) {
      for (let minute = windowStart + interval; minute <= windowEnd; minute += interval) {
        const date = buildDateAtMinute(now, dayOffset, minute);

        if (date.getTime() > now.getTime() + 60 * 1000) {
          dates.push(date);
        }

        if (dates.length >= MAX_SEDENTARY_NOTIFICATIONS) {
          return dates;
        }
      }
    }
  }

  return dates;
}

export function isQuietHoursDisabled(settings: ReminderSettings): boolean {
  return settings.quietHoursStart === settings.quietHoursEnd;
}

export function isTimeInQuietHours(time: string, quietStart: string, quietEnd: string): boolean {
  const targetMinutes = parseTimeToMinutes(time);
  const startMinutes = parseTimeToMinutes(quietStart);
  const endMinutes = parseTimeToMinutes(quietEnd);

  if (targetMinutes === null || startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return targetMinutes >= startMinutes && targetMinutes < endMinutes;
  }

  return targetMinutes >= startMinutes || targetMinutes < endMinutes;
}

export function isReminderTime(value: string): boolean {
  return parseTimeToMinutes(value) !== null;
}

export function parseTimeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeSedentaryInterval(value: number): number {
  return SEDENTARY_INTERVAL_OPTIONS.includes(value as (typeof SEDENTARY_INTERVAL_OPTIONS)[number])
    ? value
    : defaultReminderSettings.sedentaryIntervalMinutes;
}

function getActiveMinuteWindows(settings: ReminderSettings): Array<[number, number]> {
  if (isQuietHoursDisabled(settings)) {
    return [[DEFAULT_ACTIVE_START_MINUTES, DEFAULT_ACTIVE_END_MINUTES]];
  }

  const quietStart = parseTimeToMinutes(settings.quietHoursStart) ?? parseTimeToMinutes(DEFAULT_QUIET_HOURS_START);
  const quietEnd = parseTimeToMinutes(settings.quietHoursEnd) ?? parseTimeToMinutes(DEFAULT_QUIET_HOURS_END);

  if (quietStart === null || quietEnd === null) {
    return [[DEFAULT_ACTIVE_START_MINUTES, DEFAULT_ACTIVE_END_MINUTES]];
  }

  if (quietStart < quietEnd) {
    return [
      [0, quietStart],
      [quietEnd, MINUTES_PER_DAY],
    ].filter(([start, end]) => end > start) as Array<[number, number]>;
  }

  return [[quietEnd, quietStart]];
}

function buildDateAtMinute(now: Date, dayOffset: number, minute: number): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setMinutes(minute);
  return date;
}

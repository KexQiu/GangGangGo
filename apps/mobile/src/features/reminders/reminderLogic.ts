import { type QuietHoursRange, type ReminderKind, type ReminderSettings } from './reminderTypes';

export const DEFAULT_KEGEL_TIMES = ['09:30', '14:30', '20:30'];
export const DEFAULT_QUIET_HOURS_END = '08:30';
export const DEFAULT_QUIET_HOURS_START = '22:30';
export const DEFAULT_LUNCH_QUIET_HOURS_END = '14:00';
export const DEFAULT_LUNCH_QUIET_HOURS_START = '12:30';
export const MAX_QUIET_HOURS_RANGES = 4;
export const SEDENTARY_INTERVAL_OPTIONS = [45, 60, 90] as const;

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_ACTIVE_START_MINUTES = 9 * 60;
const DEFAULT_ACTIVE_END_MINUTES = 21 * 60;

export const defaultReminderSettings: ReminderSettings = {
  kegelEnabled: false,
  kegelTimes: DEFAULT_KEGEL_TIMES.slice(0, 2),
  privacyMode: true,
  quietHoursRanges: [
    {
      end: DEFAULT_QUIET_HOURS_END,
      id: 'night',
      start: DEFAULT_QUIET_HOURS_START,
    },
  ],
  sedentaryEnabled: false,
  sedentaryIntervalMinutes: 60,
  updatedAt: new Date(0).toISOString(),
};

export function normalizeReminderSettings(settings: ReminderSettings): ReminderSettings {
  const kegelTimes = settings.kegelTimes.filter(isReminderTime).slice(0, DEFAULT_KEGEL_TIMES.length);
  const quietHoursRanges = normalizeQuietHoursRanges(settings);

  return {
    ...settings,
    kegelTimes: kegelTimes.length > 0 ? kegelTimes : defaultReminderSettings.kegelTimes,
    quietHoursRanges,
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

  const ranges = normalizeQuietHoursRanges(settings);

  if (ranges.length === 1) {
    return formatQuietHoursRange(ranges[0]);
  }

  return `${ranges.length} 段 · ${ranges.map(formatQuietHoursRange).join('、')}`;
}

export function getKegelReminderTimesOutsideQuietHours(settings: ReminderSettings): string[] {
  return settings.kegelTimes.filter((time) => !isTimeInQuietHoursRanges(time, settings));
}

export function getReminderCopy(kind: ReminderKind, privacyMode: boolean) {
  if (kind === 'kegel') {
    return privacyMode
      ? {
          body: '练习提醒到了，按适合自己的节奏安排。',
          title: '小花锻炼时间',
        }
      : {
          body: '按适合自己的节奏练习，收缩后充分放松。',
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

/** 每天重复的本地时刻。活动窗口和勿扰统一使用 [开始, 结束)。 */
export function getSedentaryReminderTimes(settings: ReminderSettings): string[] {
  if (!settings.sedentaryEnabled) return [];
  const times = new Set<string>();
  const interval = normalizeSedentaryInterval(settings.sedentaryIntervalMinutes);
  for (const [start, end] of getActiveMinuteWindows(settings)) {
    for (let minute = start + interval; minute < end; minute += interval) {
      const time = `${Math.floor(minute / 60)
        .toString()
        .padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`;
      if (!isTimeInQuietHoursRanges(time, settings)) times.add(time);
    }
  }
  return [...times].sort();
}

export function isQuietHoursDisabled(settings: ReminderSettings): boolean {
  return normalizeQuietHoursRanges(settings).length === 0;
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

export function isTimeInQuietHoursRanges(time: string, settings: ReminderSettings): boolean {
  return normalizeQuietHoursRanges(settings).some((range) => isTimeInQuietHours(time, range.start, range.end));
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

  const quietRanges = normalizeQuietHoursRanges(settings).flatMap(rangeToMinuteWindows);

  if (quietRanges.length === 0) {
    return [[DEFAULT_ACTIVE_START_MINUTES, DEFAULT_ACTIVE_END_MINUTES]];
  }

  return quietRanges.reduce((activeWindows, quietWindow) => subtractMinuteWindow(activeWindows, quietWindow), [
    [DEFAULT_ACTIVE_START_MINUTES, DEFAULT_ACTIVE_END_MINUTES],
  ] as Array<[number, number]>);
}

function normalizeQuietHoursRanges(settings: ReminderSettings): QuietHoursRange[] {
  const explicitRanges = Array.isArray(settings.quietHoursRanges) ? settings.quietHoursRanges : [];
  const normalizedRanges = explicitRanges
    .map((range, index) => ({
      end: isReminderTime(range.end) ? range.end : '',
      id: typeof range.id === 'string' && range.id.length > 0 ? range.id : `quiet-${index}`,
      start: isReminderTime(range.start) ? range.start : '',
    }))
    .filter((range) => range.start && range.end && range.start !== range.end)
    .slice(0, MAX_QUIET_HOURS_RANGES);

  return sortQuietHoursRanges(normalizedRanges);
}

function sortQuietHoursRanges(ranges: QuietHoursRange[]): QuietHoursRange[] {
  return ranges.slice().sort((a, b) => (parseTimeToMinutes(a.start) ?? 0) - (parseTimeToMinutes(b.start) ?? 0));
}

function formatQuietHoursRange(range: QuietHoursRange): string {
  return `${range.start} - ${range.end}`;
}

function rangeToMinuteWindows(range: QuietHoursRange): Array<[number, number]> {
  const startMinutes = parseTimeToMinutes(range.start);
  const endMinutes = parseTimeToMinutes(range.end);

  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return [];
  }

  if (startMinutes < endMinutes) {
    return [[startMinutes, endMinutes]];
  }

  return [
    [startMinutes, MINUTES_PER_DAY],
    [0, endMinutes],
  ];
}

function subtractMinuteWindow(activeWindows: Array<[number, number]>, quietWindow: [number, number]) {
  const [quietStart, quietEnd] = quietWindow;

  return activeWindows.flatMap(([activeStart, activeEnd]) => {
    if (quietEnd <= activeStart || quietStart >= activeEnd) {
      return [[activeStart, activeEnd] as [number, number]];
    }

    return [
      [activeStart, Math.max(activeStart, quietStart)] as [number, number],
      [Math.min(activeEnd, quietEnd), activeEnd] as [number, number],
    ].filter(([start, end]) => end > start);
  });
}

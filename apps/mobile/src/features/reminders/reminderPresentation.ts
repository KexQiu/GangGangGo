import {
  DEFAULT_LUNCH_QUIET_HOURS_END,
  DEFAULT_LUNCH_QUIET_HOURS_START,
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
  parseTimeToMinutes,
} from './reminderLogic';
import type { QuietHoursRange } from './reminderTypes';

export function areQuietRangesEqual(left: readonly QuietHoursRange[], right: readonly QuietHoursRange[]): boolean {
  const normalizedLeft = normalizeComparableRanges(left);
  const normalizedRight = normalizeComparableRanges(right);

  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((range, index) => {
    const rightRange = normalizedRight[index];
    return range.start === rightRange.start && range.end === rightRange.end;
  });
}

function normalizeComparableRanges(ranges: readonly QuietHoursRange[]) {
  return ranges
    .map((range) => ({ end: range.end, start: range.start }))
    .sort((a, b) => (parseTimeToMinutes(a.start) ?? 0) - (parseTimeToMinutes(b.start) ?? 0));
}

export function formatRange(range: QuietHoursRange): string {
  return `${range.start} - ${range.end}`;
}

export function addMinutesToTime(time: string, deltaMinutes: number): string {
  const currentMinutes = parseTimeToMinutes(time) ?? 0;
  const nextMinutes = (currentMinutes + deltaMinutes + 24 * 60) % (24 * 60);
  const hours = Math.floor(nextMinutes / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (nextMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function getRangeTitle(range: QuietHoursRange, index: number): string {
  if (range.start === DEFAULT_LUNCH_QUIET_HOURS_START && range.end === DEFAULT_LUNCH_QUIET_HOURS_END) {
    return '午休闭麦';
  }
  if (range.start === DEFAULT_QUIET_HOURS_START && range.end === DEFAULT_QUIET_HOURS_END) {
    return '夜间闭麦';
  }
  return `闭麦 ${index + 1}`;
}

import { type HabitCheckIn, type HabitKey, type HabitLevel } from './habitTypes';

export const habitKeys: HabitKey[] = ['water', 'fiber', 'movement', 'bowel'];
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function createEmptyHabitCheckIn(date = getLocalDateKey()): HabitCheckIn {
  return {
    bowel: null,
    date,
    fiber: null,
    movement: null,
    updatedAt: new Date().toISOString(),
    water: null,
  };
}

export function calculateHabitCompletion(checkIn: HabitCheckIn | null | undefined): number {
  if (!checkIn) {
    return 0;
  }

  return habitKeys.filter((key) => Boolean(checkIn[key])).length;
}

export function isHabitCheckInComplete(checkIn: HabitCheckIn | null | undefined): boolean {
  return calculateHabitCompletion(checkIn) === habitKeys.length;
}

export function calculateHabitStreak(checkIns: HabitCheckIn[], now = new Date()): number {
  let streak = 0;

  for (let index = 0; index < 365; index += 1) {
    const date = getLocalDateKey(addDays(now, -index));
    const checkIn = checkIns.find((item) => item.date === date);

    if (!isHabitCheckInComplete(checkIn)) {
      break;
    }

    streak += 1;
  }

  return streak;
}

export function calculateRecentHabitStats(checkIns: HabitCheckIn[], days = 7, now = new Date()) {
  let fullCompletionDays = 0;
  let touchedDays = 0;
  let totalCompletedItems = 0;

  for (let index = 0; index < days; index += 1) {
    const date = getLocalDateKey(addDays(now, -index));
    const checkIn = checkIns.find((item) => item.date === date);
    const completion = calculateHabitCompletion(checkIn);

    if (completion > 0) {
      touchedDays += 1;
    }

    if (completion === habitKeys.length) {
      fullCompletionDays += 1;
    }

    totalCompletedItems += completion;
  }

  return {
    days,
    fullCompletionDays,
    touchedDays,
    totalCompletedItems,
  };
}

export function isHabitLevel(value: string | null | undefined): value is HabitLevel {
  return value === 'low' || value === 'medium' || value === 'good';
}

export function getHabitFeedback(checkIn: HabitCheckIn | null | undefined): string {
  const completion = calculateHabitCompletion(checkIn);

  if (completion === habitKeys.length) {
    return '今天 4 项都记上了，小账本很完整。';
  }

  if (completion > 0) {
    return `已完成 ${completion}/4，剩下的晚点补，不急。`;
  }

  return '先点一项开张，不需要填精确数字。';
}

export function getHabitPositiveFeedback(checkIn: HabitCheckIn | null | undefined, streak = 0): string {
  const completion = calculateHabitCompletion(checkIn);

  if (completion === habitKeys.length && streak > 1) {
    return `小账本满格，连续 ${streak} 天都很稳。`;
  }

  if (completion === habitKeys.length) {
    return '小账本满格，今天的习惯状态很清楚。';
  }

  if (completion >= 2) {
    return `已记 ${completion}/4，今天已经不是空白页。`;
  }

  if (completion === 1) {
    return '已经开张，再补几项会更清楚。';
  }

  return '点一下就记为达标，详情页还能改成一般或不足。';
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

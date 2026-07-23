import type { AdvancedReportDay, AdvancedReportResponse, DailyReportSnapshot } from '@xiaotidu/contracts';

import { dailyReportSnapshots } from '../../db/schema.js';
import type { CurrentUser } from '../users/userTypes.js';

const advancedReportDayCount = 90;
const defaultTimezone = 'Asia/Shanghai';

export function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function addDaysToDateKey(dateKey: string, days: number) {
  return toDateString(addDays(new Date(`${dateKey}T00:00:00.000Z`), days));
}

function getTimezoneDateKey(timezone: string | null | undefined, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      timeZone: timezone || defaultTimezone,
      year: 'numeric',
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return getTimezoneDateKey(defaultTimezone, now);
  }
}

export function getAdvancedReportRange(currentUser: CurrentUser, now = new Date()) {
  const endedAt = getTimezoneDateKey(currentUser.timezone, now);
  const startedAt = addDaysToDateKey(endedAt, -(advancedReportDayCount - 1));

  return { endedAt, startedAt };
}

export function eachDateInRange(startedAt: string, endedAt: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startedAt}T00:00:00.000Z`);
  const end = new Date(`${endedAt}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(toDateString(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function toAdvancedReportDay(date: string, snapshot?: DailyReportSnapshot): AdvancedReportDay {
  return {
    date,
    habitCompletion: snapshot?.habitCompletion ?? 0,
    habitFull: (snapshot?.habitCompletion ?? 0) === 4,
    toiletLongMeeting: snapshot?.toiletLongMeeting ?? false,
    toiletRecorded: snapshot?.toiletRecorded ?? false,
    trainingDone: snapshot?.trainingDone ?? false,
  };
}

function hasAnyAdvancedReportRecord(day: AdvancedReportDay) {
  return day.trainingDone || day.habitCompletion > 0 || day.toiletRecorded || day.toiletLongMeeting;
}

function summarizeAdvancedReportDays(days: AdvancedReportDay[], snapshots: DailyReportSnapshot[]) {
  const latestSnapshot = snapshots.at(-1) ?? null;

  return {
    currentStreakDays: latestSnapshot?.streakDays ?? 0,
    habitFullDays: days.filter((day) => day.habitFull).length,
    hasAnyRecord: days.some(hasAnyAdvancedReportRecord),
    recordDays: days.filter(hasAnyAdvancedReportRecord).length,
    toiletLongMeetingCount: days.filter((day) => day.toiletLongMeeting).length,
    toiletRecordDays: days.filter((day) => day.toiletRecorded).length,
    trainingDays: days.filter((day) => day.trainingDone).length,
  };
}

export function buildAdvancedReport(input: {
  endedAt: string;
  range: '90d';
  snapshots: DailyReportSnapshot[];
  startedAt: string;
}): AdvancedReportResponse {
  const snapshotsByDate = new Map(input.snapshots.map((snapshot) => [snapshot.date, snapshot]));
  const days = eachDateInRange(input.startedAt, input.endedAt).map((date) =>
    toAdvancedReportDay(date, snapshotsByDate.get(date)),
  );
  const latestSnapshot = input.snapshots.at(-1) ?? null;
  const summarizeLast = (dayCount: number) => {
    const windowDays = days.slice(-dayCount);
    const startedAt = windowDays[0]?.date;
    const windowSnapshots = startedAt
      ? input.snapshots.filter((snapshot) => snapshot.date >= startedAt)
      : input.snapshots;
    return summarizeAdvancedReportDays(windowDays, windowSnapshots);
  };

  return {
    days,
    endedAt: input.endedAt,
    range: input.range,
    snapshot: latestSnapshot,
    startedAt: input.startedAt,
    summaries: {
      '7d': summarizeLast(7),
      '30d': summarizeLast(30),
      '90d': summarizeLast(90),
    },
  };
}

export function dedupeSnapshotsByDate(snapshots: DailyReportSnapshot[]) {
  const snapshotsByDate = new Map<string, DailyReportSnapshot>();

  for (const snapshot of snapshots) {
    snapshotsByDate.set(snapshot.date, snapshot);
  }

  return [...snapshotsByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

export function toDailyReportSnapshot(record: typeof dailyReportSnapshots.$inferSelect): DailyReportSnapshot {
  return {
    date: record.date,
    habitCompletion: record.habitCompletion as DailyReportSnapshot['habitCompletion'],
    streakDays: record.streakDays,
    toiletLongMeeting: record.toiletLongMeeting,
    toiletRecorded: record.toiletRecorded,
    trainingDone: record.trainingDone,
  };
}

import type { DailyReportSnapshot } from '@xiaotidu/contracts';

import { calculateHabitCompletion, getLocalDateKey } from '../habits/habitLogic';
import type { HabitCheckIn } from '../habits/habitTypes';
import { isLongToiletSession } from '../toilet/toiletLogic';
import type { ToiletSession } from '../toilet/toiletTypes';
import type { TrainingSession } from '../training/trainingTypes';

export const recentReportDays = 90;
const trainingTarget = 2;

export type ReportSnapshotInput = {
  habitCheckIns: HabitCheckIn[];
  toiletSessions: ToiletSession[];
  trainingSessions: TrainingSession[];
};

export function buildTodayReportSnapshot(input: ReportSnapshotInput, now = new Date()): DailyReportSnapshot {
  return buildRecentReportSnapshots(input, now).at(-1) ?? emptySnapshot(now);
}

export function buildRecentReportSnapshots(input: ReportSnapshotInput, now = new Date()): DailyReportSnapshot[] {
  const dates = buildRecentDates(recentReportDays, now);
  const { habitCheckIns, toiletSessions, trainingSessions } = input;
  const habitsByDate = new Map(habitCheckIns.map((checkIn) => [checkIn.date, checkIn]));
  const streakByDate = buildStreakByDate(habitCheckIns);
  const toiletByDate = new Map<string, { longMeeting: boolean; recorded: boolean }>();
  const completedTrainingByDate = new Map<string, number>();

  for (const session of toiletSessions) {
    const date = getLocalDateKey(new Date(session.endedAt));
    const current = toiletByDate.get(date) ?? { longMeeting: false, recorded: false };
    current.recorded = true;
    current.longMeeting ||= isLongToiletSession(session.durationSeconds);
    toiletByDate.set(date, current);
  }

  for (const session of trainingSessions) {
    if (!session.isCompleted) continue;
    const date = getLocalDateKey(new Date(session.endedAt));
    completedTrainingByDate.set(date, (completedTrainingByDate.get(date) ?? 0) + 1);
  }

  return dates.map((date) => {
    const dateKey = getLocalDateKey(date);
    const habitCompletion = clampHabitCompletion(calculateHabitCompletion(habitsByDate.get(dateKey)));
    const toilet = toiletByDate.get(dateKey);
    return {
      date: dateKey,
      habitCompletion,
      streakDays: streakByDate.get(dateKey) ?? 0,
      toiletLongMeeting: toilet?.longMeeting ?? false,
      toiletRecorded: toilet?.recorded ?? false,
      trainingDone: (completedTrainingByDate.get(dateKey) ?? 0) >= trainingTarget,
    };
  });
}

function buildStreakByDate(checkIns: HabitCheckIn[]) {
  const result = new Map<string, number>();
  const sorted = [...checkIns].sort((left, right) => left.date.localeCompare(right.date));
  let previousDate: string | null = null;
  let streak = 0;

  for (const checkIn of sorted) {
    const complete = calculateHabitCompletion(checkIn) === 4;
    const consecutive = previousDate ? addDaysToDateKey(previousDate, 1) === checkIn.date : false;
    streak = complete ? (consecutive ? streak + 1 : 1) : 0;
    result.set(checkIn.date, streak);
    previousDate = checkIn.date;
  }
  return result;
}

function buildRecentDates(days: number, now: Date) {
  const end = new Date(now);
  end.setHours(12, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (days - 1 - index));
    return date;
  });
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

function clampHabitCompletion(value: number): DailyReportSnapshot['habitCompletion'] {
  return Math.max(0, Math.min(4, value)) as DailyReportSnapshot['habitCompletion'];
}

function emptySnapshot(now: Date): DailyReportSnapshot {
  return {
    date: getLocalDateKey(now),
    habitCompletion: 0,
    streakDays: 0,
    toiletLongMeeting: false,
    toiletRecorded: false,
    trainingDone: false,
  };
}

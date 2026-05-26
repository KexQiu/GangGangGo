import type { DailyReportSnapshot } from '@xiaotidu/contracts';

import { apiClient } from '../../api/client';
import { isProStatus, useAuthStore } from '../account/authStore';
import { calculateHabitCompletion, getLocalDateKey } from '../habits/habitLogic';
import { useHabitStore } from '../habits/habitStore';
import { isLongToiletSession } from '../toilet/toiletLogic';
import { useToiletStore } from '../toilet/toiletStore';
import { useTrainingStore } from '../training/trainingStore';
import { buildSevenDayTrend, buildThirtyDaySummary } from '../trends/trendLogic';
import { buildTodayShareSnapshot } from './shareSnapshotSync';

export async function syncTodayReportSnapshot(): Promise<boolean> {
  const { accessToken, proStatus } = useAuthStore.getState();

  if (!accessToken || !isProStatus(proStatus)) {
    return false;
  }

  try {
    await apiClient.upsertReportSnapshot(
      {
        snapshot: buildTodayReportSnapshot(),
      },
      accessToken,
    );
    return true;
  } catch {
    return false;
  }
}

export function buildTodayReportSnapshot(now = new Date()): DailyReportSnapshot {
  const habitCheckIns = useHabitStore.getState().checkIns;
  const toiletSessions = useToiletStore.getState().sessions;
  const trainingSessions = useTrainingStore.getState().sessions;
  const shareSnapshot = buildTodayShareSnapshot(now);
  const trendInput = {
    habitCheckIns,
    toiletSessions,
    trainingSessions,
  };
  const sevenDay = buildSevenDayTrend(trendInput, now);
  const thirtyDay = buildThirtyDaySummary(trendInput, now);
  const ninetyDay = buildRangeSummary(90, now);

  return {
    ...shareSnapshot,
    habitFull: shareSnapshot.habitCompletion >= 4,
    ninetyDayHabitFullDays: ninetyDay.habitFullDays,
    ninetyDayToiletLongMeetingCount: ninetyDay.longToiletCount,
    ninetyDayTrainingDays: ninetyDay.trainingDays,
    thirtyDayHabitFullDays: thirtyDay.habitFullDays,
    thirtyDayToiletLongMeetingCount: thirtyDay.longToiletCount,
    thirtyDayTrainingDays: thirtyDay.trainingActiveDays,
    toiletLongMeeting: hasLongToiletSessionOnDate(getLocalDateKey(now)),
    weeklyHabitFullDays: clampWeekCount(sevenDay.habitFullDays),
    weeklyToiletLongMeetingCount: sevenDay.longToiletCount,
    weeklyTrainingDays: clampWeekCount(sevenDay.trainingActiveDays),
  };
}

function buildRangeSummary(days: number, now: Date) {
  const habitCheckIns = useHabitStore.getState().checkIns;
  const toiletSessions = useToiletStore.getState().sessions;
  const trainingSessions = useTrainingStore.getState().sessions;
  const dateKeys = new Set<string>();

  for (let index = 0; index < days; index += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - index);
    dateKeys.add(getLocalDateKey(date));
  }

  return {
    habitFullDays: habitCheckIns.filter((checkIn) => dateKeys.has(checkIn.date) && calculateHabitCompletion(checkIn) >= 4)
      .length,
    longToiletCount: toiletSessions.filter(
      (session) => dateKeys.has(getLocalDateKey(new Date(session.endedAt))) && isLongToiletSession(session.durationSeconds),
    ).length,
    trainingDays: new Set(
      trainingSessions
        .filter((session) => session.isCompleted && dateKeys.has(getLocalDateKey(new Date(session.endedAt))))
        .map((session) => getLocalDateKey(new Date(session.endedAt))),
    ).size,
  };
}

function hasLongToiletSessionOnDate(dateKey: string): boolean {
  return useToiletStore
    .getState()
    .sessions.some(
      (session) => getLocalDateKey(new Date(session.endedAt)) === dateKey && isLongToiletSession(session.durationSeconds),
    );
}

function clampWeekCount(value: number): DailyReportSnapshot['weeklyHabitFullDays'] {
  return Math.max(0, Math.min(7, value)) as DailyReportSnapshot['weeklyHabitFullDays'];
}

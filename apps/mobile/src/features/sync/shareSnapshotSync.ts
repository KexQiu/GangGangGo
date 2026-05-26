import type { DailyShareSnapshot } from '@xiaotidu/contracts';

import { apiClient } from '../../api/client';
import { calculateHabitCompletion, calculateHabitStreak, createEmptyHabitCheckIn, getLocalDateKey } from '../habits/habitLogic';
import { getHabitCheckInForDate, useHabitStore } from '../habits/habitStore';
import { useAuthStore } from '../account/authStore';
import { getTodayToiletSessionCount, useToiletStore } from '../toilet/toiletStore';
import { getTodayCompletedTrainingCount, useTrainingStore } from '../training/trainingStore';

const trainingTarget = 2;

export async function syncTodayShareSnapshot(): Promise<boolean> {
  const token = useAuthStore.getState().accessToken;

  if (!token) {
    return false;
  }

  try {
    await apiClient.upsertShareSnapshot(
      {
        snapshot: buildTodayShareSnapshot(),
      },
      token,
    );
    return true;
  } catch {
    return false;
  }
}

export function buildTodayShareSnapshot(now = new Date()): DailyShareSnapshot {
  const date = getLocalDateKey(now);
  const habitCheckIns = useHabitStore.getState().checkIns;
  const toiletSessions = useToiletStore.getState().sessions;
  const trainingSessions = useTrainingStore.getState().sessions;
  const checkIn = getHabitCheckInForDate(habitCheckIns, date) ?? createEmptyHabitCheckIn(date);
  const trainingCount = getTodayCompletedTrainingCount(trainingSessions, now);

  return {
    date,
    habitCompletion: clampHabitCompletion(calculateHabitCompletion(checkIn)),
    streakDays: calculateHabitStreak(habitCheckIns, now),
    toiletRecorded: getTodayToiletSessionCount(toiletSessions, now) > 0,
    trainingDone: trainingCount >= trainingTarget,
  };
}

function clampHabitCompletion(value: number): DailyShareSnapshot['habitCompletion'] {
  return Math.max(0, Math.min(4, value)) as DailyShareSnapshot['habitCompletion'];
}

import { calculateHabitCompletion, createEmptyHabitCheckIn, getLocalDateKey } from '../habits/habitLogic';
import { getHabitCheckInForDate, useHabitStore } from '../habits/habitStore';
import { getActiveToiletTimerElapsedSeconds, useToiletTimerSessionStore } from '../toilet/toiletTimerSessionStore';
import { getToiletTimerStage } from '../toilet/toiletLogic';
import { getTodayCompletedTrainingCount, useTrainingStore } from '../training/trainingStore';
import { useAuthStore } from '../account/authStore';
import { type WatchTodayState } from './watchTypes';

const trainingTarget = 2;

export function buildWatchTodayState(now = new Date()): WatchTodayState {
  const date = getLocalDateKey(now);
  const auth = useAuthStore.getState();
  const habitCheckIns = useHabitStore.getState().checkIns;
  const trainingSessions = useTrainingStore.getState().sessions;
  const toiletSession = useToiletTimerSessionStore.getState().session;
  const checkIn = getHabitCheckInForDate(habitCheckIns, date) ?? createEmptyHabitCheckIn(date);
  const completedSets = getTodayCompletedTrainingCount(trainingSessions, now);
  const elapsedSeconds = getActiveToiletTimerElapsedSeconds(toiletSession, now);
  const isRunning = Boolean(toiletSession);

  return {
    account: {
      isLoggedIn: Boolean(auth.accessToken && auth.user),
      nickname: auth.user?.nickname ?? null,
    },
    date,
    generatedAt: now.toISOString(),
    habits: {
      bowelDone: Boolean(checkIn.bowel),
      completion: clampHabitCompletion(calculateHabitCompletion(checkIn)),
      fiberDone: Boolean(checkIn.fiber),
      movementDone: Boolean(checkIn.movement),
      waterDone: Boolean(checkIn.water),
    },
    pendingEventCount: 0,
    proStatus: auth.proStatus,
    toilet: {
      elapsedSeconds,
      isPaused: toiletSession?.isPaused ?? false,
      isRunning,
      stage: isRunning ? getToiletTimerStage(elapsedSeconds) : null,
    },
    training: {
      completedSets,
      done: completedSets >= trainingTarget,
    },
  };
}

function clampHabitCompletion(value: number): WatchTodayState['habits']['completion'] {
  return Math.max(0, Math.min(4, value)) as WatchTodayState['habits']['completion'];
}


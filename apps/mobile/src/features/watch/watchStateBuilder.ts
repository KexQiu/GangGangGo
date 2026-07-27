import { canAccessFeature, defaultProStatus } from '../account/accountModel';
import { getCachedCurrentUser, getCachedEntitlements } from '../account/accountQueryService';
import { useAuthStore } from '../account/authStore';
import { calculateHabitCompletion, createEmptyHabitCheckIn, getLocalDateKey } from '../habits/habitLogic';
import { getHabitCheckInForDate, useHabitStore } from '../habits/habitStore';
import { getTodayToiletSessionCount, useToiletStore } from '../toilet/toiletStore';
import { getActiveToiletTimerElapsedSeconds, useToiletTimerSessionStore } from '../toilet/toiletTimerSessionStore';
import { getToiletTimerStage } from '../toilet/toiletLogic';
import { trainingPresets } from '../training/presets';
import { getTodayCompletedTrainingCount, useTrainingStore } from '../training/trainingStore';
import { type WatchTodayState } from './watchTypes';

const trainingTarget = 2;

export function buildWatchTodayState(now = new Date()): WatchTodayState {
  const date = getLocalDateKey(now);
  const auth = useAuthStore.getState();
  const user = getCachedCurrentUser();
  const entitlements = getCachedEntitlements();
  const proStatus = entitlements?.proStatus ?? defaultProStatus;
  const habitCheckIns = useHabitStore.getState().checkIns;
  const trainingSessions = useTrainingStore.getState().sessions;
  const toiletSessions = useToiletStore.getState().sessions;
  const toiletSession = useToiletTimerSessionStore.getState().session;
  const checkIn = getHabitCheckInForDate(habitCheckIns, date) ?? createEmptyHabitCheckIn(date);
  const completedSets = getTodayCompletedTrainingCount(trainingSessions, now);
  const toiletSessionCount = getTodayToiletSessionCount(toiletSessions, now);
  const isLoggedIn = Boolean(auth.accessToken && user);
  const canUseActions = isLoggedIn && canAccessFeature(entitlements, 'watchActions');
  const elapsedSeconds = getActiveToiletTimerElapsedSeconds(toiletSession, now);
  const isRunning = canUseActions && Boolean(toiletSession);

  return {
    schemaVersion: 3,
    account: {
      isLoggedIn,
      nickname: user?.nickname ?? null,
    },
    canUseActions,
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
    proStatus,
    toilet: {
      elapsedSeconds: canUseActions ? elapsedSeconds : 0,
      isPaused: canUseActions ? (toiletSession?.isPaused ?? false) : false,
      isRunning,
      sessionCount: toiletSessionCount,
      stage: isRunning ? getToiletTimerStage(elapsedSeconds) : null,
    },
    training: {
      completedSets,
      done: completedSets >= trainingTarget,
    },
    trainingModes: trainingPresets.map((preset) => ({
      holdSeconds: preset.contractSeconds,
      id: preset.id,
      restSeconds: preset.relaxSeconds,
      rounds: preset.repetitions,
    })),
  };
}

function clampHabitCompletion(value: number): WatchTodayState['habits']['completion'] {
  return Math.max(0, Math.min(4, value)) as WatchTodayState['habits']['completion'];
}

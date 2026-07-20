import { Platform } from 'react-native';

import liveActivityModule from '../../../modules/live-activity';

import { useAppSettingsStore } from '../settings/appSettingsStore';
import { getToiletLiveActivitySnapshot } from './toiletLogic';
import { recoverToiletLiveActivityState } from './toiletLiveActivityRecovery';
import { getActiveToiletTimerElapsedSeconds, useToiletTimerSessionStore } from './toiletTimerSessionStore';

const nativeModule = Platform.OS === 'ios' ? liveActivityModule : null;
let launchRecoveryPromise: Promise<void> | null = null;

type PersistHydrationApi<T> = {
  hasHydrated: () => boolean;
  onFinishHydration: (listener: (state: T) => void) => () => void;
};

export async function isToiletLiveActivitySupported(): Promise<boolean> {
  if (!nativeModule) {
    return false;
  }

  try {
    return await nativeModule.isSupported();
  } catch {
    return false;
  }
}

export async function startToiletLiveActivity(startedAtISO: string, elapsedSeconds: number): Promise<string | null> {
  if (!nativeModule) {
    return null;
  }

  try {
    const activityId = await nativeModule.start(
      startedAtISO,
      elapsedSeconds,
      getToiletLiveActivitySnapshot(elapsedSeconds),
    );
    return activityId;
  } catch {
    return null;
  }
}

export async function pauseToiletLiveActivity(activityId: string | null, elapsedSeconds: number): Promise<void> {
  if (!nativeModule || !activityId) {
    return;
  }

  try {
    await nativeModule.pause(activityId, elapsedSeconds, getToiletLiveActivitySnapshot(elapsedSeconds));
  } catch {
    // Native Live Activity failure should not block the in-app timer.
  }
}

export async function resumeToiletLiveActivity(activityId: string | null, elapsedSeconds: number): Promise<void> {
  if (!nativeModule || !activityId) {
    return;
  }

  try {
    await nativeModule.resume(activityId, elapsedSeconds, getToiletLiveActivitySnapshot(elapsedSeconds));
  } catch {
    // Native Live Activity failure should not block the in-app timer.
  }
}

export async function syncToiletLiveActivity(
  activityId: string | null,
  elapsedSeconds: number,
  isPaused: boolean,
): Promise<void> {
  if (!nativeModule || !activityId) {
    return;
  }

  try {
    await nativeModule.sync(activityId, elapsedSeconds, isPaused, getToiletLiveActivitySnapshot(elapsedSeconds));
  } catch {
    // Native Live Activity failure should not block the in-app timer.
  }
}

export async function endToiletLiveActivity(activityId: string | null, elapsedSeconds: number): Promise<void> {
  if (!nativeModule || !activityId) {
    return;
  }

  try {
    await nativeModule.end(activityId, elapsedSeconds, getToiletLiveActivitySnapshot(elapsedSeconds));
  } catch {
    // Native Live Activity failure should not block the in-app timer.
  }
}

export async function endAllToiletLiveActivities(): Promise<void> {
  if (!nativeModule) {
    return;
  }

  try {
    await nativeModule.endAll();
  } catch {
    // Orphan cleanup is retried during the next launch recovery.
  }
}

export async function reconcileToiletLiveActivity(
  activityId: string | null,
  startedAtISO: string,
  elapsedSeconds: number,
  isPaused: boolean,
): Promise<string | null | undefined> {
  if (!nativeModule) {
    return undefined;
  }

  try {
    return await nativeModule.reconcile(
      activityId,
      startedAtISO,
      elapsedSeconds,
      isPaused,
      getToiletLiveActivitySnapshot(elapsedSeconds),
    );
  } catch {
    return undefined;
  }
}

export function recoverToiletLiveActivityAfterLaunch(): Promise<void> {
  if (!launchRecoveryPromise) {
    launchRecoveryPromise = runLaunchRecovery().finally(() => {
      launchRecoveryPromise = null;
    });
  }

  return launchRecoveryPromise;
}

async function runLaunchRecovery(): Promise<void> {
  if (!nativeModule) {
    return;
  }

  await recoverToiletLiveActivityState({
    endAll: endAllToiletLiveActivities,
    getElapsedSeconds: getActiveToiletTimerElapsedSeconds,
    readState: () => ({
      isEnabled: useAppSettingsStore.getState().toiletLiveActivityEnabled,
      session: useToiletTimerSessionStore.getState().session,
    }),
    reconcile: (session, elapsedSeconds) =>
      reconcileToiletLiveActivity(session.liveActivityId, session.startedAt, elapsedSeconds, session.isPaused),
    setActivityId: (activityId) => useToiletTimerSessionStore.getState().setLiveActivityId(activityId),
    waitUntilHydrated: async () => {
      await Promise.all([
        waitForHydration(useAppSettingsStore.persist),
        waitForHydration(useToiletTimerSessionStore.persist),
      ]);
    },
  });
}

function waitForHydration<T>(persist: PersistHydrationApi<T>): Promise<void> {
  if (persist.hasHydrated()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let unsubscribe: () => void = () => undefined;
    const finish = () => {
      unsubscribe();
      resolve();
    };
    unsubscribe = persist.onFinishHydration(finish);
    if (persist.hasHydrated()) finish();
  });
}

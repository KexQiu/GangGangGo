import { NativeModules, Platform } from 'react-native';

import {
  getToiletLiveActivitySnapshot,
  type ToiletLiveActivitySnapshot,
} from './toiletLogic';

type ToiletTimerLiveActivityNativeModule = {
  end: (activityId: string, elapsedSeconds: number, snapshot: ToiletLiveActivitySnapshot) => Promise<void>;
  isSupported: () => Promise<boolean>;
  pause: (activityId: string, elapsedSeconds: number, snapshot: ToiletLiveActivitySnapshot) => Promise<void>;
  resume: (activityId: string, elapsedSeconds: number, snapshot: ToiletLiveActivitySnapshot) => Promise<void>;
  start: (startedAtISO: string, elapsedSeconds: number, snapshot: ToiletLiveActivitySnapshot) => Promise<string | null>;
  sync: (
    activityId: string,
    elapsedSeconds: number,
    isPaused: boolean,
    snapshot: ToiletLiveActivitySnapshot,
  ) => Promise<void>;
};

const nativeModule = Platform.OS === 'ios'
  ? (NativeModules.ToiletTimerLiveActivityModule as ToiletTimerLiveActivityNativeModule | undefined)
  : undefined;

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
    console.warn('[ToiletLiveActivity] native module is unavailable.');
    return null;
  }

  try {
    const activityId = await nativeModule.start(
      startedAtISO,
      elapsedSeconds,
      getToiletLiveActivitySnapshot(elapsedSeconds),
    );
    console.log('[ToiletLiveActivity] started', activityId);
    return activityId;
  } catch (error) {
    console.warn('[ToiletLiveActivity] start failed', error);
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
    await nativeModule.sync(
      activityId,
      elapsedSeconds,
      isPaused,
      getToiletLiveActivitySnapshot(elapsedSeconds),
    );
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

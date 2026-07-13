import { Platform } from 'react-native';

import liveActivityModule from '../../../modules/live-activity';

import { getToiletLiveActivitySnapshot } from './toiletLogic';

const nativeModule = Platform.OS === 'ios' ? liveActivityModule : null;

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

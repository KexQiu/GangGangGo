import { NativeModules, Platform } from 'react-native';

type ToiletTimerLiveActivityNativeModule = {
  end: (activityId: string, elapsedSeconds: number) => Promise<void>;
  isSupported: () => Promise<boolean>;
  pause: (activityId: string, elapsedSeconds: number) => Promise<void>;
  resume: (activityId: string, elapsedSeconds: number) => Promise<void>;
  start: (startedAtISO: string, elapsedSeconds: number) => Promise<string | null>;
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
    return null;
  }

  try {
    return await nativeModule.start(startedAtISO, elapsedSeconds);
  } catch {
    return null;
  }
}

export async function pauseToiletLiveActivity(activityId: string | null, elapsedSeconds: number): Promise<void> {
  if (!nativeModule || !activityId) {
    return;
  }

  try {
    await nativeModule.pause(activityId, elapsedSeconds);
  } catch {
    // Native Live Activity failure should not block the in-app timer.
  }
}

export async function resumeToiletLiveActivity(activityId: string | null, elapsedSeconds: number): Promise<void> {
  if (!nativeModule || !activityId) {
    return;
  }

  try {
    await nativeModule.resume(activityId, elapsedSeconds);
  } catch {
    // Native Live Activity failure should not block the in-app timer.
  }
}

export async function endToiletLiveActivity(activityId: string | null, elapsedSeconds: number): Promise<void> {
  if (!nativeModule || !activityId) {
    return;
  }

  try {
    await nativeModule.end(activityId, elapsedSeconds);
  } catch {
    // Native Live Activity failure should not block the in-app timer.
  }
}

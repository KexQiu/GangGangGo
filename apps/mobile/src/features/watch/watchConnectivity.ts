import { NativeEventEmitter, NativeModules, Platform, type EmitterSubscription } from 'react-native';

import {
  type WatchConnectivityStatus,
  type WatchConnectivityDebugInfo,
  type WatchEventAck,
  type WatchSyncResult,
  type WatchTodayState,
} from './watchTypes';

type NativeWatchConnectivityModule = {
  activate?: () => Promise<boolean>;
  getDebugInfo?: () => Promise<Omit<WatchConnectivityDebugInfo, 'isSupported'>>;
  getLastReachability?: () => Promise<Omit<WatchConnectivityStatus, 'isSupported'>>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
  replyToWatchMessage?: (replyId: string, ack: WatchEventAck) => Promise<void>;
  sendTodayState?: (state: WatchTodayState & { stateJson: string }) => Promise<WatchSyncResult | void>;
};

const nativeModule = NativeModules.WatchConnectivityModule as NativeWatchConnectivityModule | undefined;

export function isWatchConnectivitySupported(): boolean {
  return Platform.OS === 'ios' && Boolean(nativeModule?.sendTodayState);
}

export async function getWatchConnectivityStatus(): Promise<WatchConnectivityStatus> {
  if (!isWatchConnectivitySupported()) {
    return {
      isPaired: false,
      isReachable: false,
      isSupported: false,
      isWatchAppInstalled: false,
    };
  }

  const reachability = await nativeModule?.getLastReachability?.();

  return {
    isPaired: reachability?.isPaired ?? false,
    isReachable: reachability?.isReachable ?? false,
    isSupported: true,
    isWatchAppInstalled: reachability?.isWatchAppInstalled ?? false,
  };
}

export async function getWatchConnectivityDebugInfo(): Promise<WatchConnectivityDebugInfo> {
  if (!isWatchConnectivitySupported()) {
    return {
      activationState: 'unsupported',
      embeddedWatchBundleIdentifiers: [],
      isPaired: false,
      isReachable: false,
      isSessionSupported: false,
      isSupported: false,
      isWatchAppInstalled: false,
    };
  }

  const debugInfo = await nativeModule?.getDebugInfo?.();

  return {
    activationError: debugInfo?.activationError ?? null,
    activationState: debugInfo?.activationState ?? 'unknown',
    embeddedWatchBundleIdentifiers: debugInfo?.embeddedWatchBundleIdentifiers ?? [],
    iPhoneBundleIdentifier: debugInfo?.iPhoneBundleIdentifier ?? null,
    isPaired: debugInfo?.isPaired ?? false,
    isReachable: debugInfo?.isReachable ?? false,
    isSessionSupported: debugInfo?.isSessionSupported ?? true,
    isSupported: true,
    isWatchAppInstalled: debugInfo?.isWatchAppInstalled ?? false,
  };
}

export async function sendWatchTodayState(state: WatchTodayState): Promise<WatchSyncResult> {
  if (!isWatchConnectivitySupported()) {
    return {
      reason: 'watch_connectivity_unavailable',
      sent: false,
    };
  }

  try {
    await nativeModule?.activate?.();
    const result = await nativeModule?.sendTodayState?.({
      ...state,
      stateJson: JSON.stringify(state),
    });

    if (result && typeof result === 'object' && 'sent' in result) {
      return result;
    }
  } catch (error) {
    return {
      reason: error instanceof Error ? error.message : 'watch_sync_failed',
      sent: false,
    };
  }

  return {
    sent: true,
  };
}

export function addWatchConnectivityEventListener(listener: (payload: unknown) => void): EmitterSubscription | null {
  if (!isWatchConnectivitySupported() || !nativeModule) {
    return null;
  }

  return new NativeEventEmitter(nativeModule).addListener('WatchConnectivityEvent', listener);
}

export async function replyToWatchMessage(replyId: string | undefined, ack: WatchEventAck) {
  if (!replyId || !isWatchConnectivitySupported()) {
    return;
  }

  await nativeModule?.replyToWatchMessage?.(replyId, ack);
}

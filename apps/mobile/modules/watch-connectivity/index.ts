import { requireOptionalNativeModule, type EventEmitter, type EventSubscription } from 'expo-modules-core';

import type {
  WatchConnectivityDebugInfo,
  WatchConnectivityStatus,
  WatchEventAck,
  WatchSyncResult,
  WatchTodayState,
} from '../../src/features/watch/watchTypes';

export type WatchConnectivityEvents = {
  onWatchConnectivityEvent: (payload: unknown) => void;
};

export type WatchConnectivityNativeModule = EventEmitter<WatchConnectivityEvents> & {
  addListener: (
    eventName: 'onWatchConnectivityEvent',
    listener: WatchConnectivityEvents['onWatchConnectivityEvent'],
  ) => EventSubscription;
  activate: () => Promise<boolean>;
  getDebugInfo: () => Promise<Omit<WatchConnectivityDebugInfo, 'isSupported'>>;
  getLastReachability: () => Promise<Omit<WatchConnectivityStatus, 'isSupported'>>;
  replyToWatchMessage: (replyId: string, ack: WatchEventAck) => Promise<void>;
  sendTodayState: (state: WatchTodayState & { stateJson: string }) => Promise<WatchSyncResult>;
};

export type WatchConnectivityEventSubscription = EventSubscription;

export default requireOptionalNativeModule<WatchConnectivityNativeModule>('GangGangGoWatchConnectivity');

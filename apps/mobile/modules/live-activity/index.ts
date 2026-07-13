import { requireOptionalNativeModule } from 'expo-modules-core';

import type { ToiletLiveActivitySnapshot } from '../../src/features/toilet/toiletLogic';

export type LiveActivityNativeModule = {
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

export default requireOptionalNativeModule<LiveActivityNativeModule>('GangGangGoLiveActivity');

import { AppState, type AppStateStatus } from 'react-native';

import { queryClient } from '../../api/queryClient';
import { queryKeys } from '../../api/queryKeys';
import { getCachedProStatus, refreshEntitlementsQuery } from '../account/accountQueryService';
import { useAuthStore } from '../account/authStore';
import { syncWatchTodayState } from '../watch/watchSyncService';
import { subscribeToLocalDataChanges } from './localDataEvents';
import { registerPushTokenIfAllowed } from './pushTokenSync';
import { syncRecentReportSnapshots } from './reportSnapshotSync';
import { syncTodayShareSnapshot } from './shareSnapshotSync';
import { SyncCoordinator, type SyncAppState } from './syncCoordinatorCore';

function normalizeAppState(state: AppStateStatus): SyncAppState {
  return state === 'active' || state === 'background' || state === 'inactive' ? state : 'unknown';
}

export const syncCoordinator = new SyncCoordinator({
  getAppState: () => normalizeAppState(AppState.currentState),
  getAuth: () => {
    const accessToken = useAuthStore.getState().accessToken;
    return {
      accessToken,
      refreshEntitlements: () => (accessToken ? refreshEntitlementsQuery(accessToken) : Promise.resolve()),
    };
  },
  registerPushToken: registerPushTokenIfAllowed,
  subscribeAppState: (listener) => {
    const subscription = AppState.addEventListener('change', (state) => listener(normalizeAppState(state)));
    return () => subscription.remove();
  },
  subscribeAuthChanges: (listener) => {
    let previousProStatus = getCachedProStatus();
    const unsubscribeAuth = useAuthStore.subscribe((state, previous) =>
      listener({
        accessTokenChanged: state.accessToken !== previous.accessToken,
        proStatusChanged: false,
      }),
    );
    const unsubscribeQuery = queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] !== queryKeys.entitlements[0]) return;
      const nextProStatus = getCachedProStatus();
      if (nextProStatus === previousProStatus) return;
      previousProStatus = nextProStatus;
      listener({ accessTokenChanged: false, proStatusChanged: true });
    });
    return () => {
      unsubscribeAuth();
      unsubscribeQuery();
    };
  },
  subscribeLocalChanges: (listener) => subscribeToLocalDataChanges(listener),
  syncReports: syncRecentReportSnapshots,
  syncShareSnapshot: syncTodayShareSnapshot,
  syncWatch: syncWatchTodayState,
});

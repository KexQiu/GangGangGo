import { AppState, type AppStateStatus } from 'react-native';

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
  getAuth: () => useAuthStore.getState(),
  registerPushToken: registerPushTokenIfAllowed,
  subscribeAppState: (listener) => {
    const subscription = AppState.addEventListener('change', (state) => listener(normalizeAppState(state)));
    return () => subscription.remove();
  },
  subscribeAuthChanges: (listener) =>
    useAuthStore.subscribe((state, previous) =>
      listener({
        accessTokenChanged: state.accessToken !== previous.accessToken,
        proStatusChanged: state.proStatus !== previous.proStatus,
      }),
    ),
  subscribeLocalChanges: (listener) => subscribeToLocalDataChanges(listener),
  syncReports: syncRecentReportSnapshots,
  syncShareSnapshot: syncTodayShareSnapshot,
  syncWatch: syncWatchTodayState,
});

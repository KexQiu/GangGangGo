import { AppState, type AppStateStatus } from 'react-native';

import { queryClient } from '../../api/queryClient';
import { accountQueryKeys } from '../account/accountQueryKeys';
import { getCachedEntitlements, refreshEntitlementsQuery } from '../account/accountQueryService';
import { useAuthStore } from '../account/authStore';
import { flushPendingSessionRevocations } from '../account/sessionRevocation';
import { syncWatchTodayState } from '../watch/watchSyncService';
import { subscribeToLocalDataChanges } from './localDataEvents';
import { syncCompleteHealthData } from './fullDataSync';
import { registerPushTokenIfAllowed } from './pushTokenSync';
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
  syncData: syncCompleteHealthData,
  subscribeAppState: (listener) => {
    // Retry offline logout while the app remains foreground, including anonymous state.
    const retry = setInterval(() => {
      if (AppState.currentState === 'active') void flushPendingSessionRevocations().catch(() => undefined);
    }, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushPendingSessionRevocations().catch(() => undefined);
      listener(normalizeAppState(state));
    });
    return () => {
      clearInterval(retry);
      subscription.remove();
    };
  },
  subscribeAuthChanges: (listener) => {
    let previousEntitlements = entitlementsFingerprint();
    const unsubscribeAuth = useAuthStore.subscribe((state, previous) =>
      listener({
        accessTokenChanged: state.accessToken !== previous.accessToken,
        entitlementsChanged: false,
      }),
    );
    const unsubscribeQuery = queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] !== accountQueryKeys.entitlements[0]) return;
      const nextEntitlements = entitlementsFingerprint();
      if (nextEntitlements === previousEntitlements) return;
      previousEntitlements = nextEntitlements;
      listener({ accessTokenChanged: false, entitlementsChanged: true });
    });
    return () => {
      unsubscribeAuth();
      unsubscribeQuery();
    };
  },
  subscribeLocalChanges: (listener) =>
    subscribeToLocalDataChanges((_revision, source) => {
      if (source === 'local') listener();
    }),
  syncWatch: syncWatchTodayState,
});

function entitlementsFingerprint() {
  const entitlements = getCachedEntitlements();
  return entitlements ? JSON.stringify(entitlements) : 'missing';
}

import { AppState, type AppStateStatus } from 'react-native';

import { queryClient } from '../../api/queryClient';
import { authSessionContext } from '../../api/sessionContext';
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
      sessionKey: authSessionContext.current()?.generation ?? null,
      refreshEntitlements: async () => {
        if (!accessToken) return { outcome: 'skipped', reason: '尚未登录。' };
        await refreshEntitlementsQuery(accessToken);
        return { outcome: 'success' };
      },
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
        accessTokenChanged:
          state.accessToken !== previous.accessToken ||
          state.isLoading !== previous.isLoading ||
          state.hasHydrated !== previous.hasHydrated,
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
  syncWatch: async (now, reason) => {
    const result = await syncWatchTodayState(now, reason);
    if (result.sent) return { outcome: 'success' };
    if (result.reason === 'watch_connectivity_unavailable')
      return { outcome: 'skipped', reason: '当前设备不支持手表连接。' };
    throw new Error(result.reason || '手表状态发送未完成。');
  },
});

function entitlementsFingerprint() {
  const entitlements = getCachedEntitlements();
  return entitlements ? JSON.stringify(entitlements) : 'missing';
}

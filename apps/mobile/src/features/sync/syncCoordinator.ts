import { AppState, type AppStateStatus } from 'react-native';

import { useAuthStore } from '../account/authStore';
import { useHabitStore } from '../habits/habitStore';
import { useToiletStore } from '../toilet/toiletStore';
import { useToiletTimerSessionStore } from '../toilet/toiletTimerSessionStore';
import { useTrainingStore } from '../training/trainingStore';
import { syncWatchTodayState } from '../watch/watchSyncService';
import { registerPushTokenIfAllowed } from './pushTokenSync';
import { syncRecentReportSnapshots } from './reportSnapshotSync';
import { syncTodayShareSnapshot } from './shareSnapshotSync';

type SyncReason = 'app_boot' | 'app_foreground' | 'auth_changed' | 'local_changed' | 'pro_changed';

class SyncCoordinator {
  private appState: AppStateStatus = AppState.currentState;
  private pendingReasons = new Set<SyncReason>();
  private running = false;
  private started = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private trailing = false;
  private unsubscribers: Array<() => void> = [];

  start() {
    if (this.started) return;
    this.started = true;
    this.unsubscribers.push(
      useAuthStore.subscribe((state, previous) => {
        if (state.accessToken !== previous.accessToken) this.schedule('auth_changed', true);
        if (state.proStatus !== previous.proStatus) this.schedule('pro_changed');
      }),
      useHabitStore.subscribe((state, previous) => {
        if (state.checkIns !== previous.checkIns) this.schedule('local_changed');
      }),
      useToiletStore.subscribe((state, previous) => {
        if (state.sessions !== previous.sessions) this.schedule('local_changed');
      }),
      useToiletTimerSessionStore.subscribe((state, previous) => {
        if (state.session !== previous.session) this.schedule('local_changed');
      }),
      useTrainingStore.subscribe((state, previous) => {
        if (state.sessions !== previous.sessions) this.schedule('local_changed');
      }),
    );
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const wasInactive = this.appState !== 'active';
      this.appState = nextState;
      if (wasInactive && nextState === 'active') this.schedule('app_foreground', true);
    });
    this.unsubscribers.push(() => appStateSubscription.remove());
    this.schedule('app_boot', true);
  }

  schedule(reason: SyncReason, immediate = false) {
    this.pendingReasons.add(reason);
    if (this.running) {
      this.trailing = true;
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), immediate ? 0 : 750);
  }

  private async flush() {
    if (this.running || this.appState !== 'active') return;
    this.timer = null;
    this.running = true;
    const reasons = new Set(this.pendingReasons);
    this.pendingReasons.clear();

    try {
      const auth = useAuthStore.getState();
      if (auth.accessToken && [...reasons].some((reason) => reason !== 'local_changed' && reason !== 'pro_changed')) {
        await auth.refreshEntitlements();
      }
      await Promise.allSettled([
        syncWatchTodayState(new Date(), [...reasons].join(',')),
        ...(auth.accessToken
          ? [syncTodayShareSnapshot(), syncRecentReportSnapshots(), registerPushTokenIfAllowed()]
          : []),
      ]);
    } finally {
      this.running = false;
      if (this.trailing || this.pendingReasons.size > 0) {
        this.trailing = false;
        this.schedule('local_changed');
      }
    }
  }
}

export const syncCoordinator = new SyncCoordinator();

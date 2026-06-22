import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppToastHost } from '../src/components/toast/AppToast';
import { useAuthStore } from '../src/features/account/authStore';
import { useHabitStore } from '../src/features/habits/habitStore';
import { configureNotificationHandler } from '../src/features/reminders/notificationService';
import { useReminderStore } from '../src/features/reminders/reminderStore';
import { registerPushTokenIfAllowed } from '../src/features/sync/pushTokenSync';
import { syncRecentReportSnapshots } from '../src/features/sync/reportSnapshotSync';
import { syncTodayShareSnapshot } from '../src/features/sync/shareSnapshotSync';
import { useToiletStore } from '../src/features/toilet/toiletStore';
import { useToiletTimerSessionStore } from '../src/features/toilet/toiletTimerSessionStore';
import { useTrainingStore } from '../src/features/training/trainingStore';
import {
  refreshEntitlementsAndSyncWatchTodayState,
  startWatchConnectivityEventListener,
  syncWatchTodayState,
} from '../src/features/watch/watchSyncService';
import { AppThemeProvider, useAppTheme } from '../src/theme/themeProvider';

function RootStack() {
  const theme = useAppTheme();
  const hydrateHabits = useHabitStore((state) => state.hydrate);
  const hydrateReminders = useReminderStore((state) => state.hydrate);
  const hydrateToilet = useToiletStore((state) => state.hydrate);
  const hydrateTraining = useTrainingStore((state) => state.hydrate);
  const accessToken = useAuthStore((state) => state.accessToken);
  const proStatus = useAuthStore((state) => state.proStatus);
  const habitCheckIns = useHabitStore((state) => state.checkIns);
  const activeToiletTimerSession = useToiletTimerSessionStore((state) => state.session);
  const toiletSessions = useToiletStore((state) => state.sessions);
  const trainingSessions = useTrainingStore((state) => state.sessions);

  useEffect(() => {
    configureNotificationHandler();
    void hydrateTraining();
    void hydrateToilet();
    void hydrateHabits();
    void hydrateReminders();
    startWatchConnectivityEventListener();
    void refreshEntitlementsAndSyncWatchTodayState(new Date(), 'app_boot');
  }, [hydrateHabits, hydrateReminders, hydrateToilet, hydrateTraining]);

  useEffect(() => {
    void refreshEntitlementsAndSyncWatchTodayState(new Date(), 'auth_state_changed');

    if (accessToken) {
      void syncCloudState();
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void syncCloudState();
  }, [accessToken, habitCheckIns, toiletSessions, trainingSessions]);

  useEffect(() => {
    void refreshEntitlementsAndSyncWatchTodayState(new Date(), 'local_state_changed');
  }, [activeToiletTimerSession, habitCheckIns, toiletSessions, trainingSessions]);

  useEffect(() => {
    void syncWatchTodayState(new Date(), 'pro_status_changed');
  }, [proStatus]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshEntitlementsAndSyncWatchTodayState(new Date(), 'app_foreground');
        if (useAuthStore.getState().accessToken) {
          void syncCloudState();
        }
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style={theme.resolvedScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
        }}
      />
      <AppToastHost />
    </>
  );
}

async function syncCloudState() {
  await syncTodayShareSnapshot();
  await syncRecentReportSnapshots();
  await registerPushTokenIfAllowed();
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <RootStack />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '../src/features/account/authStore';
import { useHabitStore } from '../src/features/habits/habitStore';
import { useReminderStore } from '../src/features/reminders/reminderStore';
import { registerPushTokenIfAllowed } from '../src/features/sync/pushTokenSync';
import { syncTodayReportSnapshot } from '../src/features/sync/reportSnapshotSync';
import { syncTodayShareSnapshot } from '../src/features/sync/shareSnapshotSync';
import { useToiletStore } from '../src/features/toilet/toiletStore';
import { useToiletTimerSessionStore } from '../src/features/toilet/toiletTimerSessionStore';
import { useTrainingStore } from '../src/features/training/trainingStore';
import { startWatchConnectivityEventListener, syncWatchTodayState } from '../src/features/watch/watchSyncService';
import { AppThemeProvider, useAppTheme } from '../src/theme/themeProvider';

function RootStack() {
  const theme = useAppTheme();
  const hydrateHabits = useHabitStore((state) => state.hydrate);
  const hydrateReminders = useReminderStore((state) => state.hydrate);
  const hydrateToilet = useToiletStore((state) => state.hydrate);
  const hydrateTraining = useTrainingStore((state) => state.hydrate);
  const accessToken = useAuthStore((state) => state.accessToken);
  const habitCheckIns = useHabitStore((state) => state.checkIns);
  const activeToiletTimerSession = useToiletTimerSessionStore((state) => state.session);
  const toiletSessions = useToiletStore((state) => state.sessions);
  const trainingSessions = useTrainingStore((state) => state.sessions);

  useEffect(() => {
    void hydrateTraining();
    void hydrateToilet();
    void hydrateHabits();
    void hydrateReminders();
    startWatchConnectivityEventListener();
    void syncWatchTodayState();
  }, [hydrateHabits, hydrateReminders, hydrateToilet, hydrateTraining]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void syncCloudState();
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void syncCloudState();
  }, [accessToken, habitCheckIns, toiletSessions, trainingSessions]);

  useEffect(() => {
    void syncWatchTodayState();
  }, [activeToiletTimerSession, habitCheckIns, toiletSessions, trainingSessions]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncWatchTodayState();
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
    </>
  );
}

async function syncCloudState() {
  await syncTodayShareSnapshot();
  await syncTodayReportSnapshot();
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

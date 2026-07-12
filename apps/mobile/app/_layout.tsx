import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '../src/api/queryClient';
import { AppToastHost } from '../src/components/toast/AppToast';
import { useHabitStore } from '../src/features/habits/habitStore';
import { configureNotificationHandler } from '../src/features/reminders/notificationService';
import { useReminderStore } from '../src/features/reminders/reminderStore';
import { syncCoordinator } from '../src/features/sync/syncCoordinator';
import { useToiletStore } from '../src/features/toilet/toiletStore';
import { useTrainingStore } from '../src/features/training/trainingStore';
import { startWatchConnectivityEventListener } from '../src/features/watch/watchSyncService';
import { AppThemeProvider, useAppTheme } from '../src/theme/themeProvider';

function RootStack() {
  const theme = useAppTheme();

  useEffect(() => {
    configureNotificationHandler();
    startWatchConnectivityEventListener();
    void Promise.all([
      useTrainingStore.getState().hydrate(),
      useToiletStore.getState().hydrate(),
      useHabitStore.getState().hydrate(),
      useReminderStore.getState().hydrate(),
    ]).finally(() => syncCoordinator.start());
  }, []);

  return (
    <>
      <StatusBar style={theme.resolvedScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerShown: false,
        }}
      />
      <AppToastHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <RootStack />
        </AppThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

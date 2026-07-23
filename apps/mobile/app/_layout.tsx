import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '../src/api/queryClient';
import { AppToastHost } from '../src/components/toast/AppToast';
import { useAuthStore } from '../src/features/account/authStore';
import { purgeExpiredLocalHealthData, rebuildRecentDailySummaries } from '../src/features/data/dailyData';
import { useHabitStore } from '../src/features/habits/habitStore';
import { subscribeToFriendNotificationResponses } from '../src/features/friends/friendNotificationNavigation';
import { configureNotificationHandler } from '../src/features/reminders/notificationService';
import { useReminderStore } from '../src/features/reminders/reminderStore';
import { syncCoordinator } from '../src/features/sync/syncCoordinator';
import { recoverToiletLiveActivityAfterLaunch } from '../src/features/toilet/toiletLiveActivity';
import { useToiletStore } from '../src/features/toilet/toiletStore';
import { useTrainingStore } from '../src/features/training/trainingStore';
import { startWatchConnectivityEventListener } from '../src/features/watch/watchSyncService';
import { routes } from '../src/navigation/routes';
import { AppThemeProvider, useAppTheme } from '../src/theme/themeProvider';

function RootStack() {
  const router = useRouter();
  const theme = useAppTheme();
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    configureNotificationHandler();
    startWatchConnectivityEventListener();
    void recoverToiletLiveActivityAfterLaunch();
    return subscribeToFriendNotificationResponses((friendUserId) => {
      router.push(routes.friendEvents(friendUserId));
    });
  }, [router]);

  useEffect(() => {
    if (!authHasHydrated) return;
    void purgeExpiredLocalHealthData()
      .then(() => rebuildRecentDailySummaries())
      .then(() =>
        Promise.all([
          useTrainingStore.getState().hydrate(),
          useToiletStore.getState().hydrate(),
          useHabitStore.getState().hydrate(),
          useReminderStore.getState().hydrate(),
        ]),
      )
      .finally(() => syncCoordinator.start());
    return () => syncCoordinator.stop();
  }, [authHasHydrated]);

  return (
    <>
      <StatusBar style={theme.resolvedScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
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

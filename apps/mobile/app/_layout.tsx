import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '../src/api/queryClient';
import { AppToastHost } from '../src/components/toast/AppToast';
import { useAuthStore } from '../src/features/account/authStore';
import { purgeExpiredLocalHealthData, rebuildRecentDailySummaries } from '../src/features/data/dailyData';
import { useHabitStore } from '../src/features/habits/habitStore';
import { subscribeToFriendNotificationResponses } from '../src/features/friends/friendNotificationNavigation';
import { configureNotificationHandler } from '../src/features/reminders/notificationService';
import { useReminderStore } from '../src/features/reminders/reminderStore';
import { subscribeToLocalDataChanges } from '../src/features/sync/localDataEvents';
import { syncCoordinator } from '../src/features/sync/syncCoordinator';
import { recoverToiletLiveActivityAfterLaunch } from '../src/features/toilet/toiletLiveActivity';
import { useToiletStore } from '../src/features/toilet/toiletStore';
import { useTrainingStore } from '../src/features/training/trainingStore';
import {
  flushGrowthEvents,
  trackActivationCompleted,
  trackGrowthEvent,
} from '../src/features/growth/growthEventTracker';
import { startWatchConnectivityEventListener } from '../src/features/watch/watchSyncService';
import { routes } from '../src/navigation/routes';
import { AppThemeProvider, useAppTheme } from '../src/theme/themeProvider';

function RootStack() {
  const router = useRouter();
  const theme = useAppTheme();
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushGrowthEvents();
    });
    const unsubscribeDataChanges = subscribeToLocalDataChanges((_revision, source) => {
      if (source === 'local') trackActivationCompleted();
    });
    return () => {
      subscription.remove();
      unsubscribeDataChanges();
    };
  }, []);

  useEffect(() => {
    if (!authHasHydrated) return;
    trackGrowthEvent('app_opened', { source: 'app_open' });
    void flushGrowthEvents();
  }, [authHasHydrated]);

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
    let cancelled = false;

    async function hydrateAppData() {
      try {
        await purgeExpiredLocalHealthData();
        await rebuildRecentDailySummaries();
      } catch {
        // A cleanup or summary rebuild failure should not block the local stores from loading.
      }

      await Promise.all([
        useTrainingStore.getState().hydrate(),
        useToiletStore.getState().hydrate(),
        useHabitStore.getState().hydrate(),
        useReminderStore.getState().hydrate(),
      ]);

      if (!cancelled) syncCoordinator.start();
    }

    void hydrateAppData();
    return () => {
      cancelled = true;
      syncCoordinator.stop();
    };
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
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AppThemeProvider>
          <RootStack />
        </AppThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

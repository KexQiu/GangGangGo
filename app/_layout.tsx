import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHabitStore } from '../src/features/habits/habitStore';
import { useReminderStore } from '../src/features/reminders/reminderStore';
import { useToiletStore } from '../src/features/toilet/toiletStore';
import { useTrainingStore } from '../src/features/training/trainingStore';
import { AppThemeProvider, useAppTheme } from '../src/theme/themeProvider';

function RootStack() {
  const theme = useAppTheme();
  const hydrateHabits = useHabitStore((state) => state.hydrate);
  const hydrateReminders = useReminderStore((state) => state.hydrate);
  const hydrateToilet = useToiletStore((state) => state.hydrate);
  const hydrateTraining = useTrainingStore((state) => state.hydrate);

  useEffect(() => {
    void hydrateTraining();
    void hydrateToilet();
    void hydrateHabits();
    void hydrateReminders();
  }, [hydrateHabits, hydrateReminders, hydrateToilet, hydrateTraining]);

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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <RootStack />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

import { ReminderSetupPrompt, ToiletPriorityCard, TrainingQuickStartCard } from '../sections/TodaySections';
import { useRouter } from 'expo-router';

import { PageHeader } from '../../../components/PageHeader';
import { Screen } from '../../../components/Screen';
import { HabitQuickCheckInCard } from '../../../features/habits/HabitQuickCheckInCard';
import { hasAnyReminderEnabled } from '../../../features/reminders/reminderLogic';
import { useReminderStore } from '../../../features/reminders/reminderStore';
import { getTodayCompletedTrainingCount, useTrainingStore } from '../../../features/training/trainingStore';
import { routes } from '../../../navigation/routes';

const trainingTarget = 2;

export default function HomeScreen() {
  const router = useRouter();
  const reminderSettings = useReminderStore((state) => state.settings);
  const trainingSessions = useTrainingStore((state) => state.sessions);
  const todayTrainingCount = getTodayCompletedTrainingCount(trainingSessions);
  const hasReminderEnabled = hasAnyReminderEnabled(reminderSettings);

  return (
    <Screen>
      <PageHeader subtitle="把今天的身体小事，一件一件做完。" title="今天轻轻安排一下" />

      <ToiletPriorityCard onPress={() => router.push(routes.toilet)} />

      {!hasReminderEnabled ? <ReminderSetupPrompt onPress={() => router.push(routes.reminders)} /> : null}

      <TrainingQuickStartCard
        completedCount={todayTrainingCount}
        onPress={() => router.push(routes.training)}
        target={trainingTarget}
      />

      <HabitQuickCheckInCard compact showDetailsButton />
    </Screen>
  );
}

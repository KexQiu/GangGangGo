import { CompactActionRow, ReminderSetupPrompt } from '../sections/TodaySections';
import { createStyles } from '../styles/todayStyles';
import { useRouter } from 'expo-router';
import { Hourglass } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { PageHeader } from '../../../components/PageHeader';
import { Screen } from '../../../components/Screen';
import { HabitQuickCheckInCard } from '../../../features/habits/HabitQuickCheckInCard';
import { hasAnyReminderEnabled } from '../../../features/reminders/reminderLogic';
import { useReminderStore } from '../../../features/reminders/reminderStore';
import { FlowerLiftIcon } from '../../../features/training/FlowerLiftIcon';
import { getTodayCompletedTrainingCount, useTrainingStore } from '../../../features/training/trainingStore';
import { routes } from '../../../navigation/routes';
import { useAppTheme } from '../../../theme/themeProvider';

const trainingTarget = 2;

export default function HomeScreen() {
  const router = useRouter();
  const reminderSettings = useReminderStore((state) => state.settings);
  const trainingSessions = useTrainingStore((state) => state.sessions);
  const todayTrainingCount = getTodayCompletedTrainingCount(trainingSessions);
  const hasReminderEnabled = hasAnyReminderEnabled(reminderSettings);
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Screen>
      <PageHeader eyebrow="小提督" subtitle="少找入口，多做正事。" title="今天轻轻安排一下" />

      {!hasReminderEnabled ? <ReminderSetupPrompt onPress={() => router.push(routes.reminders)} /> : null}

      <AppCard muted style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>
              {todayTrainingCount >= trainingTarget ? '今日小花已下班' : '今日菊花抬'}
            </Text>
            <Text style={styles.mutedText}>
              {todayTrainingCount >= trainingTarget
                ? '建议量已完成，休息和放松也是正经训练。'
                : '也就是提肛训练。轻抬轻放，呼吸在线。'}
            </Text>
          </View>
          <View style={styles.ringOuter}>
            <View style={styles.ringInner}>
              <FlowerLiftIcon
                info={colors.primaryPressed}
                primary={colors.primary}
                privacy={colors.primaryPressed}
                size={42}
                surface={colors.surface}
                variant="steady"
              />
            </View>
          </View>
        </View>

        <AppButton onPress={() => router.push(routes.training)}>
          {todayTrainingCount >= trainingTarget ? '再看一眼节奏' : '开始菊花抬'}
        </AppButton>
      </AppCard>

      <CompactActionRow
        description="正事办完就撤，别把蹲会儿开成小长会。"
        icon={Hourglass}
        onPress={() => router.push(routes.toilet)}
        title="蹲会儿"
      />

      <HabitQuickCheckInCard compact showDetailsButton />
    </Screen>
  );
}

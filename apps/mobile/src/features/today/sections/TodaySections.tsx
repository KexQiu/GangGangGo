import { Text, View } from 'react-native';
import { Bell, ChevronRight, Hourglass } from 'lucide-react-native';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { PressableScale } from '../../../components/feedback/PressableScale';
import { FlowerLiftIcon } from '../../training/FlowerLiftIcon';
import { useAppTheme } from '../../../theme/themeProvider';
import { createStyles } from '../styles/todayStyles';

type ReminderSetupPromptProps = {
  onPress: () => void;
};

export function ReminderSetupPrompt({ onPress }: ReminderSetupPromptProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <PressableScale accessibilityLabel="小暗号还没安排，去设置隐私提醒" onPress={onPress} style={styles.reminderPrompt}>
      <View style={styles.reminderPromptIcon}>
        <Bell color={colors.privacy} size={21} strokeWidth={2.4} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.reminderPromptTitle}>小暗号还没安排</Text>
        <Text style={styles.reminderPromptText}>设置一下，App 会用隐私文案轻轻提醒，不在通知栏大声广播。</Text>
      </View>
      <View style={styles.reminderPromptCta}>
        <Text style={styles.reminderPromptCtaText}>去安排</Text>
      </View>
    </PressableScale>
  );
}

type ToiletPriorityCardProps = {
  onPress: () => void;
};

export function ToiletPriorityCard({ onPress }: ToiletPriorityCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <AppCard style={styles.toiletPriorityCard}>
      <View style={styles.heroTop}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>蹲会儿</Text>
          <Text style={styles.mutedText}>正事办完就撤，别把蹲会儿开成小长会。</Text>
        </View>
        <View style={styles.toiletRing}>
          <View style={styles.toiletRingInner}>
            <Hourglass color={colors.primaryPressed} size={34} strokeWidth={2.5} />
          </View>
        </View>
      </View>
      <AppButton
        accessibilityHint="开始后会计时，并在 5 分钟后提醒你看一眼时间。"
        accessibilityLabel="蹲会儿，开始计时"
        onPress={onPress}
      >
        开始计时
      </AppButton>
    </AppCard>
  );
}

type TrainingQuickStartCardProps = {
  completedCount: number;
  onPress: () => void;
  target: number;
};

export function TrainingQuickStartCard({ completedCount, onPress, target }: TrainingQuickStartCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isComplete = completedCount >= target;

  return (
    <PressableScale
      accessibilityHint="查看训练节奏并开始菊花抬。"
      accessibilityLabel={`菊花抬，今日 ${Math.min(completedCount, target)}/${target}`}
      onPress={onPress}
      style={styles.trainingQuickCard}
    >
      <View style={styles.trainingIcon}>
        <FlowerLiftIcon
          info={colors.info}
          primary={colors.primary}
          privacy={colors.primaryPressed}
          size={30}
          surface={colors.surface}
          variant="steady"
        />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>
          菊花抬 <Text style={styles.trainingProgress}>{Math.min(completedCount, target)}/{target}</Text>
        </Text>
        <Text style={styles.trainingDescription}>
          {isComplete ? '建议量已完成，今天让肌肉轻轻下班。' : '轻抬轻放，给肌肉一点呼吸。'}
        </Text>
      </View>
      <ChevronRight color={colors.textSubtle} size={19} strokeWidth={2.4} />
    </PressableScale>
  );
}

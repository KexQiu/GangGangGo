import { Text, View } from 'react-native';
import { Bell, ChevronRight } from 'lucide-react-native';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { PressableScale } from '../../../components/feedback/PressableScale';
import { SquatIcon } from '../../../components/icons/SquatIcon';
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
        <Text style={styles.reminderPromptText}>为训练和久坐安排提醒，可选择含蓄通知文案。</Text>
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
            <SquatIcon color={colors.primaryPressed} size={32} />
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
  recordCount: number;
  completedCount: number;
  onPress: () => void;
  target: number | null;
};

export function TrainingQuickStartCard({ completedCount, recordCount, onPress, target }: TrainingQuickStartCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isComplete = target !== null && completedCount >= target;
  const progressLabel = target === null ? `今日记录 ${recordCount} 条` : `${completedCount}/${target}`;

  return (
    <PressableScale
      accessibilityHint="查看训练节奏并开始菊花抬。"
      accessibilityLabel={`菊花抬，${progressLabel}`}
      onPress={onPress}
      style={styles.trainingQuickCard}
    >
      <View style={styles.trainingIcon}>
        <FlowerLiftIcon color={colors.primaryPressed} size={32} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>
          菊花抬 <Text style={styles.trainingProgress}>{progressLabel}</Text>
        </Text>
        <Text style={styles.trainingDescription}>
          {isComplete ? '今日记录目标已完成，不必为凑次数加练。' : '先确认是否适合练习，记录目标不代表医学建议量。'}
        </Text>
      </View>
      <ChevronRight color={colors.textSubtle} size={19} strokeWidth={2.4} />
    </PressableScale>
  );
}

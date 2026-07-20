import type { ComponentType } from 'react';
import { Text, View } from 'react-native';
import { Bell, ChevronRight } from 'lucide-react-native';

import { PressableScale } from '../../../components/feedback/PressableScale';
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

type RowActionProps = {
  description: string;
  icon: IconComponent;
  onPress: () => void;
  title: string;
};

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

export function CompactActionRow({ description, icon: Icon, onPress, title }: RowActionProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <PressableScale accessibilityLabel={`${title}，${description}`} onPress={onPress} style={styles.actionRow}>
      <View style={[styles.rowIcon, styles.infoBadge]}>
        <Icon color={colors.info} size={22} strokeWidth={2.4} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.mutedText}>{description}</Text>
      </View>
      <ChevronRight color={colors.textSubtle} size={19} strokeWidth={2.4} />
    </PressableScale>
  );
}

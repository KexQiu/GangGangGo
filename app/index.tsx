import { useRouter } from 'expo-router';
import {
  Activity,
  Bell,
  ChevronRight,
  CheckCircle2,
  ChartNoAxesColumnIncreasing,
  Settings,
  ShieldCheck,
  Timer,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../src/components/AppButton';
import { AppCard } from '../src/components/AppCard';
import { PageHeader } from '../src/components/PageHeader';
import { Screen } from '../src/components/Screen';
import {
  calculateHabitCompletion,
  createEmptyHabitCheckIn,
  getLocalDateKey,
} from '../src/features/habits/habitLogic';
import { getHabitCheckInForDate, useHabitStore } from '../src/features/habits/habitStore';
import { HabitQuickCheckInCard } from '../src/features/habits/HabitQuickCheckInCard';
import { getReminderHomeSummary } from '../src/features/reminders/reminderLogic';
import { useReminderStore } from '../src/features/reminders/reminderStore';
import {
  getHabitStatusLabel,
  getTodayPositiveFeedback,
  getToiletStatusLabel,
  getTrainingStatusLabel,
} from '../src/features/today/todayFeedback';
import { getTodayToiletSessionCount, useToiletStore } from '../src/features/toilet/toiletStore';
import { getTodayCompletedTrainingCount, useTrainingStore } from '../src/features/training/trainingStore';
import { buildSevenDayTrend } from '../src/features/trends/trendLogic';
import { routes } from '../src/navigation/routes';
import { useAppTheme } from '../src/theme/themeProvider';

const trainingTarget = 2;

export default function HomeScreen() {
  const router = useRouter();
  const checkIns = useHabitStore((state) => state.checkIns);
  const reminderSettings = useReminderStore((state) => state.settings);
  const toiletSessions = useToiletStore((state) => state.sessions);
  const trainingSessions = useTrainingStore((state) => state.sessions);
  const todayTrainingCount = getTodayCompletedTrainingCount(trainingSessions);
  const todayToiletCount = getTodayToiletSessionCount(toiletSessions);
  const today = getLocalDateKey();
  const todayCheckIn = getHabitCheckInForDate(checkIns, today) ?? createEmptyHabitCheckIn(today);
  const habitCompletion = calculateHabitCompletion(todayCheckIn);
  const reminderSummary = getReminderHomeSummary(reminderSettings);
  const todayFeedback = getTodayPositiveFeedback({
    habitCompletion,
    toiletSessionCount: todayToiletCount,
    trainingCount: todayTrainingCount,
    trainingTarget,
  });
  const sevenDayTrend = buildSevenDayTrend({
    habitCheckIns: checkIns,
    toiletSessions,
    trainingSessions,
  });
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <PageHeader eyebrow="肛肛好" subtitle="少找入口，多做正事。" title="今天轻轻安排一下" />
        <Pressable
          accessibilityLabel="打开设置"
          accessibilityRole="button"
          onPress={() => router.push(routes.settings)}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
        >
          <Settings color={colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatusTile
          label="菊花抬"
          status={getTrainingStatusLabel(todayTrainingCount, trainingTarget)}
          value={`${Math.min(todayTrainingCount, trainingTarget)}/${trainingTarget}`}
        />
        <StatusTile label="小账本" status={getHabitStatusLabel(habitCompletion)} value={`${habitCompletion}/4`} />
        <StatusTile label="马桶计时" status={getToiletStatusLabel(todayToiletCount)} value={`${todayToiletCount} 次`} />
      </View>

      <AppCard muted style={styles.feedbackCard}>
        <View style={styles.feedbackIcon}>
          <CheckCircle2 color={colors.primaryPressed} size={22} strokeWidth={2.4} />
        </View>
        <View style={styles.feedbackCopy}>
          <Text style={styles.feedbackTitle}>{todayFeedback.title}</Text>
          <Text style={styles.mutedText}>{todayFeedback.body}</Text>
        </View>
      </AppCard>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(routes.trends)}
        style={({ pressed }) => [styles.trendEntry, pressed && styles.pressed]}
      >
        <View style={styles.trendIcon}>
          <ChartNoAxesColumnIncreasing color={colors.primaryPressed} size={21} strokeWidth={2.4} />
        </View>
        <View style={styles.trendCopy}>
          <Text style={styles.trendTitle}>看看最近趋势</Text>
          <Text style={styles.mutedText}>
            这周小花营业 {sevenDayTrend.trainingActiveDays} 天，小账本满格 {sevenDayTrend.habitFullDays} 天。
          </Text>
        </View>
        <ChevronRight color={colors.textSubtle} size={19} strokeWidth={2.4} />
      </Pressable>

      <AppCard muted style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{todayTrainingCount >= trainingTarget ? '今日小花已下班' : '今日菊花抬'}</Text>
            <Text style={styles.mutedText}>
              {todayTrainingCount >= trainingTarget
                ? '建议量已完成，休息和放松也是正经训练。'
                : '也就是提肛训练。轻抬轻放，呼吸在线。'}
            </Text>
          </View>
          <View style={styles.ringOuter}>
            <View style={styles.ringInner}>
              <Activity color={colors.primary} size={28} strokeWidth={2.4} />
            </View>
          </View>
        </View>

        <AppButton onPress={() => router.push(routes.training)}>
          {todayTrainingCount >= trainingTarget ? '再看一眼节奏' : '开始菊花抬'}
        </AppButton>
      </AppCard>

      <Text style={styles.sectionLabel}>快捷行动</Text>
      <View style={styles.quickGrid}>
        <QuickActionCard
          description="5 分钟敲门，15 分钟亮红灯。"
          icon={Timer}
          onPress={() => router.push(routes.toilet)}
          title="马桶计时"
        />
      </View>

      <HabitQuickCheckInCard showDetailsButton />

      <AppCard style={styles.noticeCard}>
        <View style={styles.noticeIcon}>
          <Bell color={colors.privacy} size={20} strokeWidth={2.4} />
        </View>
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>{reminderSummary.title}</Text>
          <Text style={styles.mutedText}>{reminderSummary.subtitle}</Text>
        </View>
        <AppButton onPress={() => router.push(routes.reminders)} style={styles.compactButton} variant="secondary">
          设置
        </AppButton>
      </AppCard>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(routes.safety)}
        style={({ pressed }) => [styles.safetyCard, pressed && styles.pressed]}
      >
        <ShieldCheck color={colors.info} size={20} strokeWidth={2.4} />
        <Text style={styles.safetyText}>明显便血、剧烈疼痛或不适加重时，先别硬扛，建议咨询医生。</Text>
        <ChevronRight color={colors.textSubtle} size={19} strokeWidth={2.4} />
      </Pressable>
    </Screen>
  );
}

type QuickActionCardProps = {
  description: string;
  icon: typeof Timer;
  onPress: () => void;
  title: string;
};

function QuickActionCard({ description, icon: Icon, onPress, title }: QuickActionCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
    >
      <View style={[styles.quickIcon, styles.infoBadge]}>
        <Icon color={colors.info} size={22} strokeWidth={2.4} />
      </View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickText}>{description}</Text>
    </Pressable>
  );
}

type StatusTileProps = {
  label: string;
  status: string;
  value: string;
};

function StatusTile({ label, status, value }: StatusTileProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.statusTile}>
      <Text style={styles.statusValue}>{value}</Text>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusTag}>{status}</Text>
    </View>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    headerRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    settingsButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      marginLeft: 14,
      marginTop: 4,
      width: 44,
    },
    pressed: {
      opacity: 0.78,
      transform: [{ scale: 0.98 }],
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    statusTile: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    statusValue: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 5,
      textAlign: 'center',
    },
    statusLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 8,
      textAlign: 'center',
    },
    statusTag: {
      alignSelf: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      color: colors.primaryPressed,
      fontSize: 11,
      fontWeight: '800',
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 4,
      textAlign: 'center',
    },
    feedbackCard: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 16,
    },
    feedbackIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      marginRight: 13,
      width: 40,
    },
    feedbackCopy: {
      flex: 1,
    },
    feedbackTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 5,
    },
    trendEntry: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 16,
      padding: 16,
    },
    trendIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      marginRight: 12,
      width: 36,
    },
    trendCopy: {
      flex: 1,
    },
    trendTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 5,
    },
    heroCard: {
      borderRadius: 28,
      marginBottom: 18,
      padding: 22,
    },
    heroTop: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 20,
    },
    heroCopy: {
      flex: 1,
      marginRight: 18,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 8,
    },
    mutedText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 20,
    },
    ringOuter: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 42,
      height: 84,
      justifyContent: 'center',
      width: 84,
    },
    ringInner: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      borderRadius: 28,
      borderWidth: 6,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    sectionLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 12,
    },
    quickGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    quickCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flex: 1,
      padding: 16,
    },
    quickIcon: {
      alignItems: 'center',
      borderRadius: 20,
      height: 42,
      justifyContent: 'center',
      marginBottom: 14,
      width: 42,
    },
    infoBadge: {
      backgroundColor: colors.infoSoft,
    },
    quickTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 6,
    },
    quickText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
    },
    noticeCard: {
      alignItems: 'center',
      flexDirection: 'row',
      marginTop: 16,
    },
    noticeIcon: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      marginRight: 13,
      width: 36,
    },
    noticeCopy: {
      flex: 1,
    },
    noticeTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 5,
    },
    compactButton: {
      minHeight: 42,
      paddingHorizontal: 14,
    },
    safetyCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      marginTop: 16,
      padding: 16,
    },
    safetyText: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
      marginHorizontal: 10,
    },
  });
}

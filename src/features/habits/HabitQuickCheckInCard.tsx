import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Droplets, Leaf, ListChecks, Move, Smile } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { routes } from '../../navigation/routes';
import { useAppTheme } from '../../theme/themeProvider';
import {
  calculateHabitCompletion,
  calculateHabitStreak,
  calculateRecentHabitStats,
  createEmptyHabitCheckIn,
  getHabitPositiveFeedback,
  getLocalDateKey,
} from './habitLogic';
import { getHabitCheckInForDate, useHabitStore } from './habitStore';
import { type HabitKey } from './habitTypes';

const quickHabitItems: Array<{
  doneLabel: string;
  icon: typeof Droplets;
  key: HabitKey;
  title: string;
}> = [
  {
    doneLabel: '饮水达标',
    icon: Droplets,
    key: 'water',
    title: '饮水',
  },
  {
    doneLabel: '纤维达标',
    icon: Leaf,
    key: 'fiber',
    title: '纤维',
  },
  {
    doneLabel: '活动够',
    icon: Move,
    key: 'movement',
    title: '活动',
  },
  {
    doneLabel: '排便顺畅',
    icon: Smile,
    key: 'bowel',
    title: '排便',
  },
];

type HabitQuickCheckInCardProps = {
  compact?: boolean;
  showDetailsButton?: boolean;
};

export function HabitQuickCheckInCard({ compact = false, showDetailsButton = true }: HabitQuickCheckInCardProps) {
  const router = useRouter();
  const checkIns = useHabitStore((state) => state.checkIns);
  const setHabitLevel = useHabitStore((state) => state.setHabitLevel);
  const today = getLocalDateKey();
  const todayCheckIn = getHabitCheckInForDate(checkIns, today) ?? createEmptyHabitCheckIn(today);
  const completion = calculateHabitCompletion(todayCheckIn);
  const streak = calculateHabitStreak(checkIns);
  const recentStats = calculateRecentHabitStats(checkIns);
  const { colors } = useAppTheme();
  const styles = createStyles(colors, compact);

  async function markGood(key: HabitKey) {
    await Haptics.selectionAsync();
    await setHabitLevel(today, key, 'good');
  }

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <ListChecks color={colors.primaryPressed} size={23} strokeWidth={2.4} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>今日小账本</Text>
          <Text style={styles.subtitle}>{getHabitPositiveFeedback(todayCheckIn, streak)}</Text>
        </View>
        <View style={styles.headerSide}>
          <View style={styles.scorePill}>
            <Text style={styles.scoreText}>{completion}/4</Text>
          </View>
          {compact && showDetailsButton ? (
            <Pressable
              accessibilityLabel="精细记一笔"
              accessibilityRole="button"
              onPress={() => router.push(routes.habits)}
              style={({ pressed }) => [styles.detailLink, pressed && styles.pressed]}
            >
              <Text style={styles.detailLinkText}>精细记</Text>
              <ChevronRight color={colors.textSubtle} size={14} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.quickGrid}>
        {quickHabitItems.map((item) => {
          const Icon = item.icon;
          const selected = todayCheckIn[item.key] === 'good';
          const recorded = Boolean(todayCheckIn[item.key]);

          return (
            <Pressable
              accessibilityHint="点一下会把这一项记为达标。"
              accessibilityLabel={selected ? `${item.doneLabel}，已完成` : `标记${item.title}达标`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={item.key}
              onPress={() => {
                void markGood(item.key);
              }}
              style={({ pressed }) => [
                styles.quickButton,
                recorded && styles.quickButtonRecorded,
                selected && styles.quickButtonSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.quickIcon, selected && styles.quickIconSelected]}>
                {selected ? (
                  <Check color={colors.primaryPressed} size={18} strokeWidth={2.8} />
                ) : (
                  <Icon color={recorded ? colors.primaryPressed : colors.textMuted} size={18} strokeWidth={2.4} />
                )}
              </View>
              <Text style={[styles.quickTitle, selected && styles.quickTitleSelected]}>
                {selected ? item.doneLabel : item.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!compact ? (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>连续完整</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{recentStats.fullCompletionDays}</Text>
            <Text style={styles.statLabel}>近 7 天满卡</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{recentStats.totalCompletedItems}</Text>
            <Text style={styles.statLabel}>近 7 天记录</Text>
          </View>
        </View>
      ) : null}

      {!compact && showDetailsButton ? (
        <AppButton onPress={() => router.push(routes.habits)} style={styles.detailsButton} variant="secondary">
          精细记一笔
        </AppButton>
      ) : null}
    </AppCard>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors, compact: boolean) {
  return StyleSheet.create({
    card: {
      padding: compact ? 16 : 18,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: compact ? 12 : 16,
    },
    headerIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: compact ? 17 : 20,
      height: compact ? 34 : 42,
      justifyContent: 'center',
      marginRight: compact ? 10 : 12,
      width: compact ? 34 : 42,
    },
    headerCopy: {
      flex: 1,
    },
    headerSide: {
      alignItems: 'flex-end',
      marginLeft: 10,
    },
    title: {
      color: colors.text,
      fontSize: compact ? 16 : 17,
      fontWeight: '800',
      marginBottom: compact ? 3 : 5,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 19,
    },
    scorePill: {
      backgroundColor: colors.primarySoft,
      borderRadius: 17,
      paddingHorizontal: compact ? 10 : 12,
      paddingVertical: compact ? 6 : 8,
    },
    scoreText: {
      color: colors.primaryPressed,
      fontSize: 13,
      fontWeight: '800',
    },
    detailLink: {
      alignItems: 'center',
      flexDirection: 'row',
      marginTop: 6,
      minHeight: 24,
    },
    detailLinkText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    quickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: compact ? 8 : 10,
      marginBottom: compact ? 0 : 16,
    },
    quickButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: compact ? 16 : 18,
      borderWidth: 1,
      flexBasis: '47%',
      flexDirection: 'row',
      flexGrow: 1,
      minHeight: compact ? 46 : 52,
      paddingHorizontal: compact ? 10 : 12,
    },
    quickButtonRecorded: {
      borderColor: colors.primary,
    },
    quickButtonSelected: {
      backgroundColor: colors.primarySoft,
    },
    quickIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      height: compact ? 24 : 28,
      justifyContent: 'center',
      marginRight: compact ? 8 : 9,
      width: compact ? 24 : 28,
    },
    quickIconSelected: {
      backgroundColor: colors.surface,
    },
    quickTitle: {
      color: colors.text,
      flex: 1,
      fontSize: compact ? 12 : 13,
      fontWeight: '800',
    },
    quickTitleSelected: {
      color: colors.primaryPressed,
    },
    statsRow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      flexDirection: 'row',
      paddingVertical: 14,
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 4,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    statDivider: {
      backgroundColor: colors.border,
      height: 32,
      width: 1,
    },
    detailsButton: {
      marginTop: 14,
      minHeight: 46,
    },
    pressed: {
      opacity: 0.82,
      transform: [{ scale: 0.99 }],
    },
  });
}

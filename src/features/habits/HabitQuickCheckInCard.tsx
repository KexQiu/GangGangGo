import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ChevronRight, Droplets, Leaf, ListChecks, Move, Smile } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AnimatedCheckBadge } from '../../components/feedback/AnimatedCheckBadge';
import { PressableScale } from '../../components/feedback/PressableScale';
import { SuccessBurst } from '../../components/feedback/SuccessBurst';
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
import { type HabitKey, type HabitLevel } from './habitTypes';

const quickHabitItems: Array<{
  icon: typeof Droplets;
  key: HabitKey;
  levelLabels: Record<HabitLevel, string>;
  title: string;
}> = [
  {
    icon: Droplets,
    key: 'water',
    levelLabels: {
      good: '达标',
      low: '不足',
      medium: '一般',
    },
    title: '饮水',
  },
  {
    icon: Leaf,
    key: 'fiber',
    levelLabels: {
      good: '达标',
      low: '不足',
      medium: '一般',
    },
    title: '纤维',
  },
  {
    icon: Move,
    key: 'movement',
    levelLabels: {
      good: '活动够',
      low: '久坐多',
      medium: '一般',
    },
    title: '活动',
  },
  {
    icon: Smile,
    key: 'bowel',
    levelLabels: {
      good: '顺畅',
      low: '困难',
      medium: '一般',
    },
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
  const [burstKey, setBurstKey] = useState(0);
  const [justCompleted, setJustCompleted] = useState(false);
  const justCompletedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function markGood(key: HabitKey) {
    const nextCompletion = todayCheckIn[key] === 'good' ? completion : Math.min(completion + 1, 4);

    await Haptics.selectionAsync();
    await setHabitLevel(today, key, 'good');

    if (completion < 4 && nextCompletion === 4) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBurstKey((current) => current + 1);
      setJustCompleted(true);

      if (justCompletedTimerRef.current) {
        clearTimeout(justCompletedTimerRef.current);
      }

      justCompletedTimerRef.current = setTimeout(() => {
        setJustCompleted(false);
      }, 2200);
    }
  }

  return (
    <AppCard style={styles.card}>
      <View style={styles.burstAnchor}>
        <SuccessBurst playKey={burstKey} size={118} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <ListChecks color={colors.primaryPressed} size={23} strokeWidth={2.4} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>今日小账本</Text>
          <Text style={styles.subtitle}>
            {justCompleted ? '小账本满格，今日营业稳定。' : getHabitPositiveFeedback(todayCheckIn, streak)}
          </Text>
        </View>
        <View style={styles.headerSide}>
          <View style={styles.scorePill}>
            <Text style={styles.scoreText}>{completion}/4</Text>
          </View>
          {compact && showDetailsButton ? (
            <PressableScale
              accessibilityLabel="精细记一笔"
              onPress={() => router.push(routes.habits)}
              style={styles.detailLink}
            >
              <Text style={styles.detailLinkText}>精细记</Text>
              <ChevronRight color={colors.textSubtle} size={14} strokeWidth={2.4} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      <View style={styles.quickGrid}>
        {quickHabitItems.map((item) => {
          const Icon = item.icon;
          const activeLevel = todayCheckIn[item.key];
          const selected = activeLevel === 'good';
          const recorded = Boolean(activeLevel);
          const stateTone = getHabitLevelTone(colors, activeLevel);
          const stateLabel = activeLevel ? item.levelLabels[activeLevel] : '未记录';

          return (
            <PressableScale
              accessibilityHint="点一下会把这一项记为达标。"
              accessibilityLabel={`${item.title}，${stateLabel}，点一下标记达标`}
              accessibilityState={{ selected }}
              key={item.key}
              onPress={() => {
                void markGood(item.key);
              }}
              style={[
                styles.quickButton,
                recorded && {
                  backgroundColor: stateTone.backgroundColor,
                  borderColor: stateTone.borderColor,
                },
              ]}
            >
              <View style={[styles.quickIcon, { backgroundColor: stateTone.iconBackgroundColor }]}>
                <Icon color={stateTone.iconColor} size={18} strokeWidth={2.4} />
                {selected ? (
                  <View style={styles.checkBadge}>
                    <AnimatedCheckBadge active={selected} size={12} />
                  </View>
                ) : null}
              </View>
              <View style={styles.quickCopy}>
                <Text style={styles.quickTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.quickState, { color: stateTone.textColor }]} numberOfLines={1}>
                  {stateLabel}
                </Text>
              </View>
            </PressableScale>
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
      overflow: 'hidden',
      padding: compact ? 16 : 18,
    },
    burstAnchor: {
      alignItems: 'center',
      height: 0,
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 80,
      zIndex: 2,
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
    quickIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      height: compact ? 24 : 28,
      justifyContent: 'center',
      marginRight: compact ? 8 : 9,
      width: compact ? 24 : 28,
    },
    checkBadge: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      height: 16,
      justifyContent: 'center',
      position: 'absolute',
      right: -5,
      top: -5,
      width: 16,
    },
    quickCopy: {
      flex: 1,
      minWidth: 0,
    },
    quickTitle: {
      color: colors.text,
      fontSize: compact ? 12 : 13,
      fontWeight: '800',
    },
    quickState: {
      fontSize: compact ? 11 : 12,
      fontWeight: '800',
      marginTop: 2,
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
  });
}

function getHabitLevelTone(colors: ThemeColors, level: HabitLevel | null) {
  if (level === 'good') {
    return {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      iconBackgroundColor: colors.surface,
      iconColor: colors.primaryPressed,
      textColor: colors.primaryPressed,
    };
  }

  if (level === 'medium') {
    return {
      backgroundColor: colors.infoSoft,
      borderColor: colors.info,
      iconBackgroundColor: colors.surface,
      iconColor: colors.info,
      textColor: colors.info,
    };
  }

  if (level === 'low') {
    return {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
      iconBackgroundColor: colors.surface,
      iconColor: colors.warning,
      textColor: colors.warning,
    };
  }

  return {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    iconBackgroundColor: colors.surface,
    iconColor: colors.textMuted,
    textColor: colors.textMuted,
  };
}

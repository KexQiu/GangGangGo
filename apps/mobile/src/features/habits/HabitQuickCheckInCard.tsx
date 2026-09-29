import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ChevronRight, Droplets, Footprints, Leaf, ListChecks } from 'lucide-react-native';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SquatIcon } from '../../components/icons/SquatIcon';
import type { AppIconProps } from '../../components/icons/iconTypes';
import { showToast } from '../../components/toast/AppToast';
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
import { getQuickHabitAction } from './habitPresentation';
import { getHabitLevelStandard, habitStandards } from './habitStandards';
import { getHabitCheckInForDate, useHabitStore } from './habitStore';
import { type HabitKey, type HabitRecordLevel } from './habitTypes';

const quickHabitItems: Array<{
  icon: ComponentType<AppIconProps>;
  key: HabitKey;
  title: string;
}> = [
  {
    icon: Droplets,
    key: 'water',
    title: '饮水',
  },
  {
    icon: Leaf,
    key: 'fiber',
    title: '蔬果全谷',
  },
  {
    icon: Footprints,
    key: 'movement',
    title: '活动',
  },
  {
    icon: SquatIcon,
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
  const clearHabitLevel = useHabitStore((state) => state.clearHabitLevel);
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
  const savingKeys = useRef(new Set<HabitKey>());
  const justCompletedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (justCompletedTimerRef.current) clearTimeout(justCompletedTimerRef.current);
    },
    [],
  );

  async function handleQuickAction(key: HabitKey) {
    if (savingKeys.current.has(key)) return;
    savingKeys.current.add(key);
    try {
      const activeLevel = todayCheckIn[key];

      const action = getQuickHabitAction(key, activeLevel);
      if (action === 'edit') {
        router.push(routes.habits);
        return;
      }

      if (action === 'clear') {
        void Haptics.selectionAsync().catch(() => undefined);
        await clearHabitLevel(today, key);
        setJustCompleted(false);

        if (justCompletedTimerRef.current) {
          clearTimeout(justCompletedTimerRef.current);
          justCompletedTimerRef.current = null;
        }

        return;
      }

      const nextCompletion = activeLevel ? completion : Math.min(completion + 1, 4);

      void Haptics.selectionAsync().catch(() => undefined);
      await setHabitLevel(today, key, 'good');

      if (completion < 4 && nextCompletion === 4) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setBurstKey((current) => current + 1);
        setJustCompleted(true);

        if (justCompletedTimerRef.current) {
          clearTimeout(justCompletedTimerRef.current);
        }

        justCompletedTimerRef.current = setTimeout(() => {
          setJustCompleted(false);
        }, 2200);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败，请重试。', { type: 'error' });
    } finally {
      savingKeys.current.delete(key);
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
            {justCompleted ? '今天 4 项都已记录。' : getHabitPositiveFeedback(todayCheckIn, streak)}
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
          const action = getQuickHabitAction(item.key, activeLevel);
          const recorded = Boolean(activeLevel);
          const stateTone = getHabitLevelTone(colors, activeLevel);
          const stateLabel = activeLevel ? getHabitLevelStandard(item.key, activeLevel).label : '未记录';
          const targetLabel = habitStandards[item.key].quickTargetLabel;

          return (
            <PressableScale
              accessibilityHint={
                action === 'edit'
                  ? '打开详情，按实际情况修改或清除记录。'
                  : action === 'clear'
                    ? '再点一下会撤销这一项。'
                    : `点一下记为${habitStandards[item.key].levels.good.label}，其他分档可在详情中填写。`
              }
              accessibilityLabel={`${item.title}，${recorded ? `已记录，${stateLabel}` : stateLabel}`}
              accessibilityState={{ selected: recorded }}
              key={item.key}
              onPress={() => void handleQuickAction(item.key)}
              style={[
                styles.quickButton,
                recorded && {
                  backgroundColor: stateTone.backgroundColor,
                  borderColor: stateTone.borderColor,
                },
              ]}
            >
              <View style={[styles.quickIcon, { backgroundColor: stateTone.iconBackgroundColor }]}>
                <Icon color={stateTone.iconColor} size={20} strokeWidth={2} />
                {recorded ? (
                  <View style={styles.checkBadge}>
                    <AnimatedCheckBadge active={recorded} size={12} />
                  </View>
                ) : null}
              </View>
              <View style={styles.quickCopy}>
                <Text style={styles.quickTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.quickState, { color: stateTone.textColor }]}>{stateLabel}</Text>
                <Text style={styles.quickHint}>
                  {action === 'edit'
                    ? recorded
                      ? '修改记录'
                      : '按实际填写'
                    : action === 'clear'
                      ? '撤销记录'
                      : `快捷 ${targetLabel}`}
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
      paddingVertical: compact ? 8 : 10,
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
    quickHint: {
      color: colors.textSubtle,
      fontSize: compact ? 10 : 11,
      fontWeight: '700',
      marginTop: 1,
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
      fontSize: 12,
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

function getHabitLevelTone(colors: ThemeColors, level: HabitRecordLevel | null) {
  if (level !== null) {
    return {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      iconBackgroundColor: colors.surface,
      iconColor: colors.primaryPressed,
      textColor: colors.primaryPressed,
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

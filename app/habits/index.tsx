import { Droplets, Leaf, ListChecks, Move, Smile } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import {
  calculateHabitCompletion,
  calculateHabitStreak,
  calculateRecentHabitStats,
  createEmptyHabitCheckIn,
  getHabitPositiveFeedback,
  getLocalDateKey,
} from '../../src/features/habits/habitLogic';
import { getHabitCheckInForDate, useHabitStore } from '../../src/features/habits/habitStore';
import { type HabitKey, type HabitLevel } from '../../src/features/habits/habitTypes';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

const habitItems: Array<{
  icon: typeof Droplets;
  key: HabitKey;
  title: string;
  options: Array<{
    label: string;
    level: HabitLevel;
  }>;
}> = [
  {
    icon: Droplets,
    key: 'water',
    options: [
      { label: '不足', level: 'low' },
      { label: '一般', level: 'medium' },
      { label: '达标', level: 'good' },
    ],
    title: '今日饮水',
  },
  {
    icon: Leaf,
    key: 'fiber',
    options: [
      { label: '不足', level: 'low' },
      { label: '一般', level: 'medium' },
      { label: '达标', level: 'good' },
    ],
    title: '膳食纤维',
  },
  {
    icon: Move,
    key: 'movement',
    options: [
      { label: '久坐多', level: 'low' },
      { label: '一般', level: 'medium' },
      { label: '活动够', level: 'good' },
    ],
    title: '活动/走动',
  },
  {
    icon: Smile,
    key: 'bowel',
    options: [
      { label: '困难', level: 'low' },
      { label: '一般', level: 'medium' },
      { label: '顺畅', level: 'good' },
    ],
    title: '排便顺畅度',
  },
];

export default function HabitsScreen() {
  const today = getLocalDateKey();
  const checkIns = useHabitStore((state) => state.checkIns);
  const setHabitLevel = useHabitStore((state) => state.setHabitLevel);
  const todayCheckIn = getHabitCheckInForDate(checkIns, today) ?? createEmptyHabitCheckIn(today);
  const completion = calculateHabitCompletion(todayCheckIn);
  const streak = calculateHabitStreak(checkIns);
  const recentStats = calculateRecentHabitStats(checkIns);
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.home} title="小账本" />

      <PageHeader
        eyebrow="健康习惯"
        subtitle="快速记今天的基础习惯，不写精确数字，也不写小作文。"
        title="今日小账本"
      />

      <AppCard muted style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <ListChecks color={colors.primaryPressed} size={30} strokeWidth={2.4} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryValue}>{completion}/4</Text>
          <Text style={styles.summaryText}>{getHabitPositiveFeedback(todayCheckIn, streak)}</Text>
        </View>
      </AppCard>

      <View style={styles.statsRow}>
        <AppCard style={styles.statCard}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>连续完整</Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <Text style={styles.statValue}>{recentStats.fullCompletionDays}</Text>
          <Text style={styles.statLabel}>近 7 天满卡</Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <Text style={styles.statValue}>{recentStats.totalCompletedItems}</Text>
          <Text style={styles.statLabel}>近 7 天记录</Text>
        </AppCard>
      </View>

      <View style={styles.list}>
        {habitItems.map((item) => {
          const Icon = item.icon;
          const activeLevel = todayCheckIn[item.key];

          return (
            <AppCard key={item.key} style={styles.habitCard}>
              <View style={styles.habitHeader}>
                <View style={styles.iconBadge}>
                  <Icon color={colors.primaryPressed} size={21} strokeWidth={2.4} />
                </View>
                <Text style={styles.habitTitle}>{item.title}</Text>
              </View>

              <View style={styles.segmentRow}>
                {item.options.map((option) => {
                  const selected = activeLevel === option.level;

                  return (
                    <Text
                      key={option.level}
                      onPress={() => {
                        void setHabitLevel(today, item.key, option.level);
                      }}
                      style={[styles.segment, selected && styles.segmentSelected]}
                    >
                      {option.label}
                    </Text>
                  );
                })}
              </View>
            </AppCard>
          );
        })}
      </View>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    summaryCard: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 18,
    },
    summaryIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      marginRight: 14,
      width: 56,
    },
    summaryCopy: {
      flex: 1,
    },
    summaryValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 6,
    },
    summaryText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 18,
    },
    statCard: {
      alignItems: 'center',
      flex: 1,
      padding: 14,
    },
    statValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 5,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
    },
    list: {
      gap: 14,
    },
    habitCard: {
      padding: 18,
    },
    habitHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 16,
    },
    iconBadge: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      marginRight: 12,
      width: 34,
    },
    habitTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
      fontWeight: '800',
    },
    segmentRow: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      flexDirection: 'row',
      padding: 4,
    },
    segment: {
      borderRadius: 14,
      color: colors.textMuted,
      flex: 1,
      fontSize: 13,
      fontWeight: '800',
      overflow: 'hidden',
      paddingVertical: 11,
      textAlign: 'center',
    },
    segmentSelected: {
      backgroundColor: colors.surface,
      color: colors.primaryPressed,
    },
  });
}

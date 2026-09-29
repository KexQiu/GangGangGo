import {
  AnimatedLevelIcon,
  HabitLevelSlider,
  SelectedStandardNote,
  habitLevelOptions,
} from '../sections/HabitLevelSections';
import { createStyles } from '../styles/habitsStyles';
import * as Haptics from 'expo-haptics';
import { Droplets, Leaf, ListChecks, Move, PlusCircle, Smile } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { showToast } from '../../../components/toast/AppToast';
import { AppCard } from '../../../components/AppCard';
import { AppButton } from '../../../components/AppButton';
import { AppTopBar } from '../../../components/AppTopBar';
import { PressableScale } from '../../../components/feedback/PressableScale';
import { PageHeader } from '../../../components/PageHeader';
import { Screen } from '../../../components/Screen';
import {
  calculateHabitCompletion,
  calculateHabitStreak,
  calculateRecentHabitStats,
  createEmptyHabitCheckIn,
  getHabitPositiveFeedback,
  getLocalDateKey,
  habitKeys,
} from '../../../features/habits/habitLogic';
import { habitStandards } from '../../../features/habits/habitStandards';
import { getHabitStateLabel } from '../../../features/habits/habitPresentation';
import { getHabitCheckInForDate, useHabitStore } from '../../../features/habits/habitStore';
import { type HabitKey, type HabitRecordLevel } from '../../../features/habits/habitTypes';
import { emergencyGuidance, medicalGuidance } from '../../safety/healthGuidance';
import { routes } from '../../../navigation/routes';
import { useAppTheme } from '../../../theme/themeProvider';

const habitItems: Array<{
  icon: typeof Droplets;
  key: HabitKey;
}> = habitKeys.map((key) => ({
  icon: {
    bowel: Smile,
    fiber: Leaf,
    movement: Move,
    water: Droplets,
  }[key],
  key,
}));

export default function HabitsScreen() {
  const today = getLocalDateKey();
  const checkIns = useHabitStore((state) => state.checkIns);
  const setHabitLevel = useHabitStore((state) => state.setHabitLevel);
  const clearHabitLevel = useHabitStore((state) => state.clearHabitLevel);
  const todayCheckIn = getHabitCheckInForDate(checkIns, today) ?? createEmptyHabitCheckIn(today);
  const completion = calculateHabitCompletion(todayCheckIn);
  const streak = calculateHabitStreak(checkIns);
  const recentStats = calculateRecentHabitStats(checkIns);
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  async function selectHabitLevel(key: HabitKey, level: HabitRecordLevel | null) {
    void Haptics.selectionAsync().catch(() => undefined);
    try {
      if (level === null) await clearHabitLevel(today, key);
      else await setHabitLevel(today, key, level);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败，请重试。', { type: 'error' });
    }
  }

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.home} title="小账本" />

      <PageHeader subtitle="快速记今天的基础习惯，不写精确数字，也不写小作文。" title="今日小账本" />

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
          const standard = habitStandards[item.key];
          const options = habitLevelOptions[item.key];

          return (
            <AppCard key={item.key} style={styles.habitCard}>
              <View style={styles.habitHeader}>
                <View style={styles.iconBadge}>
                  <Icon color={colors.primaryPressed} size={21} strokeWidth={2.4} />
                </View>
                <View style={styles.habitHeaderCopy}>
                  <View style={styles.habitTitleRow}>
                    <Text style={styles.habitTitle}>{standard.title}</Text>
                    {activeLevel ? (
                      <AnimatedLevelIcon level={activeLevel} label={getHabitStateLabel(options, activeLevel)} />
                    ) : null}
                  </View>
                  <Text style={styles.habitSubtitle}>{standard.goodReference}</Text>
                </View>
              </View>

              {activeLevel === 'not_today' ? (
                <>
                  <SelectedStandardNote habitKey={item.key} level={activeLevel} />
                  <AppButton variant="secondary" onPress={() => void selectHabitLevel('bowel', 'medium')}>
                    排过便，先记为一般
                  </AppButton>
                </>
              ) : activeLevel ? (
                <>
                  <HabitLevelSlider
                    level={activeLevel}
                    options={options}
                    title={standard.title}
                    onChange={(level) => {
                      void selectHabitLevel(item.key, level);
                    }}
                  />
                  <SelectedStandardNote habitKey={item.key} level={activeLevel} />
                </>
              ) : (
                <PressableScale
                  accessibilityLabel={`${standard.title}，未记录，按${standard.levels.medium.label}开始记录`}
                  onPress={() => {
                    void selectHabitLevel(item.key, 'medium');
                  }}
                  style={styles.emptyState}
                >
                  <View style={styles.emptyIcon}>
                    <PlusCircle color={colors.textMuted} size={19} strokeWidth={2.4} />
                  </View>
                  <View style={styles.emptyCopy}>
                    <Text style={styles.emptyTitle}>先记为{standard.levels.medium.label}</Text>
                    <Text style={styles.emptyText}>再按实际情况调整记录分档。</Text>
                  </View>
                </PressableScale>
              )}
              {item.key === 'bowel' && activeLevel !== 'not_today' ? (
                <AppButton variant="secondary" onPress={() => void selectHabitLevel('bowel', 'not_today')}>
                  今日未排便
                </AppButton>
              ) : null}
              {item.key === 'bowel' && activeLevel ? (
                <AppButton variant="secondary" onPress={() => void selectHabitLevel('bowel', null)}>
                  清除此项
                </AppButton>
              ) : null}
            </AppCard>
          );
        })}
      </View>

      <Text style={styles.footnote}>
        分档仅用于日常记录，不是健康评分或医学达标标准。{medicalGuidance}
        {emergencyGuidance}
      </Text>
    </Screen>
  );
}

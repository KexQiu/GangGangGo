import * as Haptics from 'expo-haptics';
import {
  Droplets,
  Frown,
  Leaf,
  ListChecks,
  Meh,
  Move,
  PlusCircle,
  Smile,
} from 'lucide-react-native';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from 'react-native';

import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PressableScale } from '../../src/components/feedback/PressableScale';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import {
  calculateHabitCompletion,
  calculateHabitStreak,
  calculateRecentHabitStats,
  createEmptyHabitCheckIn,
  getHabitPositiveFeedback,
  getLocalDateKey,
  habitKeys,
} from '../../src/features/habits/habitLogic';
import { getHabitLevelStandard, habitStandards } from '../../src/features/habits/habitStandards';
import { getHabitCheckInForDate, useHabitStore } from '../../src/features/habits/habitStore';
import { type HabitKey, type HabitLevel } from '../../src/features/habits/habitTypes';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

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

const levelOrder: HabitLevel[] = ['low', 'medium', 'good'];

const habitLevelOptions: Record<HabitKey, HabitLevelOption[]> = {
  bowel: createHabitLevelOptions('bowel'),
  fiber: createHabitLevelOptions('fiber'),
  movement: createHabitLevelOptions('movement'),
  water: createHabitLevelOptions('water'),
};

const levelIcons: Record<HabitLevel, ComponentType<IconProps>> = {
  good: Smile,
  low: Frown,
  medium: Meh,
};

type IconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

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

  async function selectHabitLevel(key: HabitKey, level: HabitLevel) {
    await Haptics.selectionAsync();
    await setHabitLevel(today, key, level);
  }

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
                      <AnimatedLevelIcon
                        level={activeLevel}
                        label={getHabitStateLabel(options, activeLevel)}
                      />
                    ) : null}
                  </View>
                  <Text style={styles.habitSubtitle}>{standard.goodReference}</Text>
                </View>
              </View>

              {activeLevel ? (
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
                  accessibilityLabel={`${standard.title}，未记录，按一般开始记录`}
                  onPress={() => {
                    void selectHabitLevel(item.key, 'medium');
                  }}
                  style={styles.emptyState}
                >
                  <View style={styles.emptyIcon}>
                    <PlusCircle color={colors.textMuted} size={19} strokeWidth={2.4} />
                  </View>
                  <View style={styles.emptyCopy}>
                    <Text style={styles.emptyTitle}>先按一般记</Text>
                    <Text style={styles.emptyText}>点一下展开滑块，再改成不足或达标。</Text>
                  </View>
                </PressableScale>
              )}
            </AppCard>
          );
        })}
      </View>

      <Text style={styles.footnote}>
        标准只是日常记录参考；如果医生有安排，听医生的。明显便血、疼痛加重或不适持续时，先看小花说明书。
      </Text>
    </Screen>
  );
}

type HabitLevelOption = {
  label: string;
  level: HabitLevel;
};

function createHabitLevelOptions(key: HabitKey): HabitLevelOption[] {
  return levelOrder.map((level) => ({
    label: habitStandards[key].levels[level].label,
    level,
  }));
}

type HabitLevelSliderProps = {
  level: HabitLevel;
  onChange: (level: HabitLevel) => void;
  options: HabitLevelOption[];
  title: string;
};

function HabitLevelSlider({ level, onChange, options, title }: HabitLevelSliderProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [trackWidth, setTrackWidth] = useState(0);
  const position = useRef(new Animated.Value(levelOrder.indexOf(level))).current;
  const activeIndexRef = useRef(levelOrder.indexOf(level));
  const trackWidthRef = useRef(trackWidth);
  const segmentWidth = trackWidth > 0 ? trackWidth / levelOrder.length : 0;
  const activeOption = options.find((option) => option.level === level) ?? options[1];
  const activeTone = getLevelTone(colors, level);
  const horizontalPadding = 4;
  const thumbWidth = segmentWidth > 0 ? Math.max(segmentWidth - horizontalPadding * 2, 0) : 0;
  const maxTranslateX = trackWidth > 0 ? trackWidth - horizontalPadding * 2 - thumbWidth : 0;

  trackWidthRef.current = trackWidth;

  useEffect(() => {
    const nextIndex = levelOrder.indexOf(level);
    activeIndexRef.current = nextIndex;
    Animated.spring(position, {
      friction: 8,
      tension: 160,
      toValue: nextIndex,
      useNativeDriver: true,
    }).start();
  }, [level, position]);

  function commitLevel(nextLevel: HabitLevel) {
    activeIndexRef.current = levelOrder.indexOf(nextLevel);
    void Haptics.selectionAsync();
    onChange(nextLevel);
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 4,
      onPanResponderGrant: () => {
        position.stopAnimation((value) => {
          activeIndexRef.current = Math.round(value);
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const currentSegmentWidth = trackWidthRef.current / levelOrder.length;

        if (currentSegmentWidth <= 0) {
          return;
        }

        const nextValue = clamp(
          activeIndexRef.current + gestureState.dx / currentSegmentWidth,
          0,
          levelOrder.length - 1,
        );
        position.setValue(nextValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentSegmentWidth = trackWidthRef.current / levelOrder.length;

        if (currentSegmentWidth <= 0) {
          return;
        }

        const nextIndex = Math.round(
          clamp(activeIndexRef.current + gestureState.dx / currentSegmentWidth, 0, levelOrder.length - 1),
        );
        commitLevel(levelOrder[nextIndex]);
      },
      onPanResponderTerminate: () => {
        Animated.spring(position, {
          friction: 8,
          tension: 160,
          toValue: activeIndexRef.current,
          useNativeDriver: true,
        }).start();
      },
      onStartShouldSetPanResponder: () => false,
    }),
  ).current;

  return (
    <View>
      <View
        accessibilityLabel={`${title}状态滑块，当前${activeOption.label}`}
        accessibilityRole="adjustable"
        style={styles.sliderTrack}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        {trackWidth > 0 ? (
          <Animated.View
            style={[
              styles.sliderThumb,
              {
                backgroundColor: activeTone.softColor,
                borderColor: activeTone.color,
                width: thumbWidth,
                transform: [
                  {
                    translateX: position.interpolate({
                      inputRange: [0, levelOrder.length - 1],
                      outputRange: [0, maxTranslateX],
                    }),
                  },
                ],
              },
            ]}
          />
        ) : null}

        {options.map((option) => {
          const selected = option.level === level;
          const OptionIcon = levelIcons[option.level];
          const tone = getLevelTone(colors, option.level);

          return (
            <Pressable
              accessibilityLabel={`${title}：${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.level}
              onPress={() => commitLevel(option.level)}
              style={styles.sliderStep}
            >
              <OptionIcon color={selected ? tone.color : colors.textSubtle} size={15} strokeWidth={2.5} />
              <Text style={[styles.sliderStepText, selected && ({ color: tone.color } as TextStyle)]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type SelectedStandardNoteProps = {
  habitKey: HabitKey;
  level: HabitLevel;
};

function SelectedStandardNote({ habitKey, level }: SelectedStandardNoteProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const tone = getLevelTone(colors, level);
  const standard = getHabitLevelStandard(habitKey, level);

  return (
    <View style={[styles.selectedStandardNote, { backgroundColor: tone.softColor }]}>
      <Text style={[styles.selectedStandardLabel, { color: tone.color }]}>{standard.label}</Text>
      <Text style={styles.selectedStandardText}>{standard.description}</Text>
    </View>
  );
}

type AnimatedLevelIconProps = {
  label: string;
  level: HabitLevel;
};

function AnimatedLevelIcon({ label, level }: AnimatedLevelIconProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const progress = useRef(new Animated.Value(1)).current;
  const tone = getLevelTone(colors, level);
  const Icon = levelIcons[level];

  useEffect(() => {
    progress.setValue(0.72);
    Animated.spring(progress, {
      friction: 6,
      tension: 180,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [level, progress]);

  return (
    <Animated.View
      accessibilityLabel={`当前状态：${label}`}
      style={[
        styles.headerStateIcon,
        {
          backgroundColor: tone.softColor,
          opacity: progress,
          transform: [{ scale: progress }],
        },
      ]}
    >
      <Icon color={tone.color} size={17} strokeWidth={2.5} />
    </Animated.View>
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
    habitHeaderCopy: {
      flex: 1,
    },
    habitTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 4,
    },
    habitTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    headerStateIcon: {
      alignItems: 'center',
      borderRadius: 14,
      height: 28,
      justifyContent: 'center',
      marginLeft: 8,
      width: 28,
    },
    habitSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      flexDirection: 'row',
      minHeight: 62,
      paddingHorizontal: 14,
    },
    emptyIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      height: 32,
      justifyContent: 'center',
      marginRight: 11,
      width: 32,
    },
    emptyCopy: {
      flex: 1,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 3,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    selectedStandardNote: {
      borderRadius: 14,
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    selectedStandardLabel: {
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 4,
    },
    selectedStandardText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
    },
    footnote: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 18,
      marginBottom: 4,
      marginTop: 16,
      textAlign: 'center',
    },
    sliderTrack: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 54,
      overflow: 'hidden',
      padding: 4,
    },
    sliderThumb: {
      borderRadius: 15,
      borderWidth: 1,
      bottom: 4,
      left: 4,
      position: 'absolute',
      top: 4,
    },
    sliderStep: {
      alignItems: 'center',
      flex: 1,
      gap: 3,
      justifyContent: 'center',
      zIndex: 1,
    },
    sliderStepText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
  });
}

function getHabitStateLabel(options: HabitLevelOption[], level: HabitLevel): string {
  return `当前：${options.find((option) => option.level === level)?.label ?? '已记录'}`;
}

function getLevelTone(colors: ThemeColors, level: HabitLevel): {
  color: string;
  iconBackground: string;
  softColor: string;
} {
  if (level === 'good') {
    return {
      color: colors.primaryPressed,
      iconBackground: colors.surface,
      softColor: colors.primarySoft,
    };
  }

  if (level === 'medium') {
    return {
      color: colors.info,
      iconBackground: colors.surface,
      softColor: colors.infoSoft,
    };
  }

  return {
    color: colors.warning,
    iconBackground: colors.surface,
    softColor: colors.warningSoft,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

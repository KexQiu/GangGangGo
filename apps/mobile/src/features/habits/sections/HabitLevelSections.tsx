import * as Haptics from 'expo-haptics';
import { Frown, Meh, Smile } from 'lucide-react-native';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, type TextStyle, View } from 'react-native';

import { getHabitLevelStandard, habitStandards } from '../habitStandards';
import { clamp, getLevelTone, type HabitLevelOption } from '../habitPresentation';
import type { HabitKey, HabitLevel } from '../habitTypes';
import { useAppTheme } from '../../../theme/themeProvider';
import { createStyles } from '../styles/habitsStyles';

const levelOrder: HabitLevel[] = ['low', 'medium', 'good'];

export const habitLevelOptions: Record<HabitKey, HabitLevelOption[]> = {
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

export function HabitLevelSlider({ level, onChange, options, title }: HabitLevelSliderProps) {
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

export function SelectedStandardNote({ habitKey, level }: SelectedStandardNoteProps) {
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

export function AnimatedLevelIcon({ label, level }: AnimatedLevelIconProps) {
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

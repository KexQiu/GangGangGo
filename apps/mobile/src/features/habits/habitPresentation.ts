import type { useAppTheme } from '../../theme/themeProvider';
import type { HabitLevel } from './habitTypes';

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export type HabitLevelOption = {
  label: string;
  level: HabitLevel;
};

export function getHabitStateLabel(options: HabitLevelOption[], level: HabitLevel): string {
  return `当前：${options.find((option) => option.level === level)?.label ?? '已记录'}`;
}

export function getLevelTone(
  colors: ThemeColors,
  level: HabitLevel,
): {
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

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

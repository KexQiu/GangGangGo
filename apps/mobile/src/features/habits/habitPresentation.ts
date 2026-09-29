import type { useAppTheme } from '../../theme/themeProvider';
import type { HabitKey, HabitLevel, HabitRecordLevel } from './habitTypes';

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export type HabitLevelOption = {
  label: string;
  level: HabitLevel;
};

export function getHabitStateLabel(options: HabitLevelOption[], level: HabitRecordLevel): string {
  if (level === 'not_today') return '当前：今日未排便';
  return `当前：${options.find((option) => option.level === level)?.label ?? '已记录'}`;
}

export function getLevelTone(
  colors: ThemeColors,
  level: HabitRecordLevel,
  habitKey: HabitKey,
): {
  color: string;
  iconBackground: string;
  softColor: string;
} {
  if (habitKey !== 'bowel' || level === 'good') {
    return {
      color: colors.primaryPressed,
      iconBackground: colors.surface,
      softColor: colors.primarySoft,
    };
  }

  if (level === 'not_today') {
    return { color: colors.textMuted, iconBackground: colors.surface, softColor: colors.surfaceMuted };
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

// Keep quick-fill from overwriting an existing, more precise record.
export function getQuickHabitAction(key: HabitKey, level: HabitRecordLevel | null): 'edit' | 'clear' | 'record' {
  if (key === 'bowel' || (level !== null && level !== 'good')) return 'edit';
  return level === 'good' ? 'clear' : 'record';
}

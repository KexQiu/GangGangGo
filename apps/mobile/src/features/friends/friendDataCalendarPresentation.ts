import type { FriendSharedDay } from '@xiaotidu/contracts';
import type { CalendarListProps } from 'react-native-calendars';

import type { ThemeColors } from '../../theme/colors';

type FriendCalendarMarkedDates = NonNullable<CalendarListProps['markedDates']>;

export type FriendCalendarRange = {
  maxDate: string;
  maxMonth: string;
  minDate: string;
  minMonth: string;
  pastScrollRange: number;
};

export function buildFriendCalendarMarkedDates(
  days: FriendSharedDay[],
  colors: ThemeColors,
  selectedDate?: string,
): FriendCalendarMarkedDates {
  const markedDates: FriendCalendarMarkedDates = {};

  for (const day of days) {
    markedDates[day.date] = {
      accessibilityLabel: buildAccessibilityLabel(day),
      dots: [
        { color: trainingColor(day, colors), key: 'training' },
        { color: habitColor(day, colors), key: 'habit' },
        { color: toiletColor(day, colors), key: 'toilet' },
      ],
      selected: day.date === selectedDate,
      selectedColor: colors.primarySoft,
      selectedTextColor: colors.text,
    };
  }

  return markedDates;
}

export function getFriendCalendarRange(days: FriendSharedDay[]): FriendCalendarRange | null {
  if (days.length === 0) return null;
  const dates = days.map((day) => day.date).sort();
  const minDate = dates[0]!;
  const maxDate = dates.at(-1)!;
  const minMonth = minDate.slice(0, 7);
  const maxMonth = maxDate.slice(0, 7);

  return {
    maxDate,
    maxMonth,
    minDate,
    minMonth,
    pastScrollRange: Math.max(0, monthOrdinal(maxMonth) - monthOrdinal(minMonth)),
  };
}

function trainingColor(day: FriendSharedDay, colors: ThemeColors) {
  if (day.training.level === 'none') return colors.border;
  return day.training.trainingDone ? colors.primary : colors.textSubtle;
}

function habitColor(day: FriendSharedDay, colors: ThemeColors) {
  if (day.habit.level === 'none') return colors.border;
  return day.habit.completionCount > 0 ? colors.info : colors.textSubtle;
}

function toiletColor(day: FriendSharedDay, colors: ThemeColors) {
  if (day.toilet.level === 'none') return colors.border;
  if (!day.toilet.toiletRecorded) return colors.textSubtle;
  return day.toilet.level === 'detailed' && day.toilet.attentionCount > 0 ? colors.danger : colors.warning;
}

function buildAccessibilityLabel(day: FriendSharedDay) {
  const [year, month, date] = day.date.split('-');
  return `${Number(year)} 年 ${Number(month)} 月 ${Number(date)} 日，${trainingLabel(day)}，${habitLabel(day)}，${toiletLabel(day)}，查看详情`;
}

function trainingLabel(day: FriendSharedDay) {
  if (day.training.level === 'none') return '菊花抬未授权';
  return day.training.trainingDone ? '菊花抬已达标' : '菊花抬未达标';
}

function habitLabel(day: FriendSharedDay) {
  if (day.habit.level === 'none') return '小账本未授权';
  return `小账本 ${day.habit.completionCount} 项`;
}

function toiletLabel(day: FriendSharedDay) {
  if (day.toilet.level === 'none') return '蹲会儿未授权';
  return day.toilet.toiletRecorded ? '蹲会儿已记录' : '蹲会儿未记录';
}

function monthOrdinal(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return year * 12 + month - 1;
}

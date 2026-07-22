import type { DailyActivitySummary } from '@xiaotidu/contracts';
import type { CalendarListProps } from 'react-native-calendars';

import type { ThemeColors } from '../../theme/colors';

type DataCalendarMarkedDates = NonNullable<CalendarListProps['markedDates']>;

export type DataCalendarRange = {
  maxDate: string;
  maxMonth: string;
  minDate: string;
  minMonth: string;
  pastScrollRange: number;
};

export function buildDataCalendarMarkedDates(
  summaries: DailyActivitySummary[],
  colors: ThemeColors,
  selectedDate?: string,
): DataCalendarMarkedDates {
  const markedDates: DataCalendarMarkedDates = {};
  for (const summary of summaries) {
    markedDates[summary.date] = {
      accessibilityLabel: buildAccessibilityLabel(summary),
      selected: summary.date === selectedDate,
      selectedColor: colors.primarySoft,
      selectedTextColor: colors.text,
      dots: [
        {
          color: summary.training.completedSessionCount > 0 ? colors.primary : colors.border,
          key: 'training',
        },
        {
          color: summary.habit.completionCount > 0 ? colors.info : colors.border,
          key: 'habit',
        },
        {
          color:
            summary.toilet.sessionCount > 0
              ? summary.toilet.attentionCount > 0
                ? colors.danger
                : colors.warning
              : colors.border,
          key: 'toilet',
        },
      ],
    };
  }
  return markedDates;
}

export function getDataCalendarRange(summaries: DailyActivitySummary[], today: string): DataCalendarRange {
  const minDate = summaries.reduce((earliest, summary) => (summary.date < earliest ? summary.date : earliest), today);
  const minMonth = minDate.slice(0, 7);
  const maxMonth = today.slice(0, 7);
  return {
    maxDate: today,
    maxMonth,
    minDate,
    minMonth,
    pastScrollRange: Math.max(0, monthOrdinal(maxMonth) - monthOrdinal(minMonth)),
  };
}

function buildAccessibilityLabel(summary: DailyActivitySummary) {
  const [year, month, day] = summary.date.split('-');
  return `${Number(year)} 年 ${Number(month)} 月 ${Number(day)} 日，训练 ${summary.training.completedSessionCount} 次，小账本 ${summary.habit.completionCount} 项，蹲会儿 ${summary.toilet.sessionCount} 次，查看详情`;
}

function monthOrdinal(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return year * 12 + month - 1;
}

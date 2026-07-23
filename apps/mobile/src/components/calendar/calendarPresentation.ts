import { StyleSheet } from 'react-native';
import { LocaleConfig, type CalendarListProps } from 'react-native-calendars';

import type { ThemeColors } from '../../theme/colors';

export const standardCalendarHeight = 330;

const calendarLocale = 'zh-cn';

LocaleConfig.locales[calendarLocale] = {
  dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'],
  monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  today: '今天',
};
LocaleConfig.defaultLocale = calendarLocale;

export function createCalendarListTheme(colors: ThemeColors): NonNullable<CalendarListProps['theme']> {
  return {
    arrowColor: colors.primaryPressed,
    calendarBackground: 'transparent',
    dayTextColor: colors.text,
    disabledArrowColor: colors.border,
    dotStyle: { borderRadius: 2, height: 4, marginTop: 2, width: 4 },
    monthTextColor: colors.text,
    textDayFontSize: 13,
    textDayFontWeight: '700',
    textDayHeaderFontSize: 11,
    textDayHeaderFontWeight: '800',
    textDisabledColor: colors.textSubtle,
    textMonthFontSize: 15,
    textMonthFontWeight: '900',
    textSectionTitleColor: colors.textMuted,
    todayTextColor: colors.primaryPressed,
    weekVerticalMargin: 6,
  };
}

export function createCalendarSurfaceStyles(colors: ThemeColors) {
  return StyleSheet.create({
    calendarCard: { marginBottom: 20, padding: 14 },
    calendarLegend: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 11 },
    calendarList: { backgroundColor: 'transparent', height: standardCalendarHeight },
    calendarLoading: { height: standardCalendarHeight },
    calendarMonth: { paddingLeft: 0, paddingRight: 0 },
    calendarViewport: { overflow: 'hidden' },
    legendDot: { borderRadius: 3, height: 6, width: 6 },
    legendItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
    legendText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  });
}

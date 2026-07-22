import type { DailyActivitySummary } from '@xiaotidu/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { CalendarList, LocaleConfig, type CalendarListProps, type DateData } from 'react-native-calendars';

import { AppCard } from '../../components/AppCard';
import { useAppTheme } from '../../theme/themeProvider';
import { getLocalDateKey } from '../habits/habitLogic';
import { buildDataCalendarMarkedDates, getDataCalendarRange } from './dataCalendarPresentation';
import { createDataStyles } from './styles/dataStyles';

const calendarHeight = 330;
const calendarLocale = 'zh-cn';

LocaleConfig.locales[calendarLocale] = {
  dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'],
  monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  today: '今天',
};
LocaleConfig.defaultLocale = calendarLocale;

export function DailyDataCalendar({
  onSelectDate,
  selectedDate,
  summaries,
}: {
  onSelectDate: (date: string) => void;
  selectedDate: string;
  summaries: DailyActivitySummary[];
}) {
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);
  const [width, setWidth] = useState(0);
  const today = getLocalDateKey();
  const range = useMemo(() => getDataCalendarRange(summaries, today), [summaries, today]);
  const markedDates = useMemo(
    () => buildDataCalendarMarkedDates(summaries, colors, selectedDate),
    [colors, selectedDate, summaries],
  );
  const calendarTheme = useMemo<NonNullable<CalendarListProps['theme']>>(
    () => ({
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
    }),
    [colors],
  );
  const [visibleMonth, setVisibleMonth] = useState(range.maxMonth);

  useEffect(() => setVisibleMonth(range.maxMonth), [range.maxMonth]);

  const selectDate = useCallback(
    (date: DateData) => {
      onSelectDate(date.dateString);
    },
    [onSelectDate],
  );
  const updateVisibleMonth = useCallback((months: DateData[]) => {
    const month = months[0];
    if (month) setVisibleMonth(month.dateString.slice(0, 7));
  }, []);

  return (
    <AppCard style={styles.calendarCard}>
      <View
        onLayout={(event) => {
          const nextWidth = Math.round(event.nativeEvent.layout.width);
          if (nextWidth !== width) setWidth(nextWidth);
        }}
        style={styles.calendarViewport}
      >
        {width > 0 ? (
          <CalendarList
            animateScroll
            calendarHeight={calendarHeight}
            calendarStyle={styles.calendarMonth}
            calendarWidth={width}
            current={range.maxDate}
            disableAllTouchEventsForDisabledDays
            disableArrowLeft={visibleMonth <= range.minMonth}
            disableArrowRight={visibleMonth >= range.maxMonth}
            firstDay={1}
            futureScrollRange={0}
            hideArrows={false}
            hideExtraDays
            horizontal
            key={`${width}-${range.minDate}-${range.maxDate}`}
            markedDates={markedDates}
            markingType="multi-dot"
            maxDate={range.maxDate}
            minDate={range.minDate}
            monthFormat="yyyy年 M月"
            onDayPress={selectDate}
            onVisibleMonthsChange={updateVisibleMonth}
            pagingEnabled
            pastScrollRange={range.pastScrollRange}
            showScrollIndicator={false}
            style={styles.calendarList}
            testID="daily-data-calendar"
            theme={calendarTheme}
          />
        ) : (
          <View style={styles.calendarLoading} />
        )}
      </View>
      <View style={styles.calendarLegend}>
        <Legend color={colors.primary} label="菊花抬" />
        <Legend color={colors.info} label="小账本" />
        <Legend color={colors.warning} label="蹲会儿" />
      </View>
    </AppCard>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

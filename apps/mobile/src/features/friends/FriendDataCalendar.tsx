import type { FriendSharedDay } from '@xiaotidu/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { CalendarList, type DateData } from 'react-native-calendars';

import { AppCard } from '../../components/AppCard';
import {
  createCalendarListTheme,
  createCalendarSurfaceStyles,
  standardCalendarHeight,
} from '../../components/calendar/calendarPresentation';
import { useAppTheme } from '../../theme/themeProvider';
import { buildFriendCalendarMarkedDates, getFriendCalendarRange } from './friendDataCalendarPresentation';

export function FriendDataCalendar({
  days,
  onSelectDate,
  selectedDate,
}: {
  days: FriendSharedDay[];
  onSelectDate: (date: string) => void;
  selectedDate?: string;
}) {
  const { colors } = useAppTheme();
  const styles = createCalendarSurfaceStyles(colors);
  const [width, setWidth] = useState(0);
  const range = useMemo(() => getFriendCalendarRange(days), [days]);
  const markedDates = useMemo(
    () => buildFriendCalendarMarkedDates(days, colors, selectedDate),
    [colors, days, selectedDate],
  );
  const [visibleMonth, setVisibleMonth] = useState(range?.maxMonth ?? '');

  useEffect(() => {
    if (range) setVisibleMonth(range.maxMonth);
  }, [range]);

  const selectDate = useCallback((date: DateData) => onSelectDate(date.dateString), [onSelectDate]);
  const updateVisibleMonth = useCallback((months: DateData[]) => {
    const month = months[0];
    if (month) setVisibleMonth(month.dateString.slice(0, 7));
  }, []);
  const calendarTheme = useMemo(() => createCalendarListTheme(colors), [colors]);

  if (!range) return null;

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
            calendarHeight={standardCalendarHeight}
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
            testID="friend-data-calendar"
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
  const styles = createCalendarSurfaceStyles(colors);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

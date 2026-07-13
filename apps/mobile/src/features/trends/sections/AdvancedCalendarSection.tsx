import type { AdvancedReportDay } from '@xiaotidu/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '../../../theme/themeProvider';
import {
  buildCalendarMonths,
  formatDateLabel,
  formatDayAccessibility,
  formatFullDateLabel,
  formatHabitStatus,
  formatToiletStatus,
  getCalendarCellSize,
  getDefaultMonthIndex,
  getHabitDotColor,
  getTodayDateKey,
  getToiletDotColor,
  getTrainingDotColor,
  hasAnyDayRecord,
  weekdayLabels,
} from '../advancedReportPresentation';
import { createAdvancedCalendarStyles } from '../styles/advancedCalendarStyles';

export function ReportCalendarGrid({ days }: { days: AdvancedReportDay[] }) {
  const { colors } = useAppTheme();
  const styles = createAdvancedCalendarStyles(colors);
  const scrollViewRef = useRef<ScrollView>(null);
  const months = useMemo(() => buildCalendarMonths(days), [days]);
  const todayDateKey = useMemo(() => getTodayDateKey(), []);
  const defaultMonthIndex = useMemo(() => getDefaultMonthIndex(months, todayDateKey), [months, todayDateKey]);
  const [calendarWidth, setCalendarWidth] = useState(0);
  const [selectedDay, setSelectedDay] = useState<AdvancedReportDay | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(defaultMonthIndex);
  const cellSize = useMemo(() => getCalendarCellSize(calendarWidth), [calendarWidth]);
  const monthsKey = useMemo(() => months.map((month) => month.key).join('|'), [months]);

  const handleCalendarLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    setCalendarWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }, []);
  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (calendarWidth <= 0) return;
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / calendarWidth);
      setSelectedMonthIndex(Math.max(0, Math.min(months.length - 1, nextIndex)));
    },
    [calendarWidth, months.length],
  );

  useEffect(() => setSelectedMonthIndex(defaultMonthIndex), [defaultMonthIndex, monthsKey]);
  useEffect(() => {
    if (calendarWidth <= 0 || months.length === 0) return;
    scrollViewRef.current?.scrollTo({ animated: false, x: selectedMonthIndex * calendarWidth, y: 0 });
  }, [calendarWidth, months.length, selectedMonthIndex]);

  return (
    <View onLayout={handleCalendarLayout} style={styles.calendarGrid}>
      <ScrollView
        bounces={false}
        decelerationRate="fast"
        horizontal
        onMomentumScrollEnd={handleMomentumScrollEnd}
        pagingEnabled
        ref={scrollViewRef}
        scrollEnabled={months.length > 1}
        showsHorizontalScrollIndicator={false}
        style={styles.calendarPager}
      >
        {months.map((month) => (
          <View key={month.key} style={[styles.calendarMonthPage, { width: calendarWidth || undefined }]}>
            <View style={styles.calendarMonth}>
              <Text style={styles.calendarMonthTitle}>{month.title}</Text>
              <View style={styles.weekdayRow}>
                {weekdayLabels.map((label) => (
                  <Text key={label} style={[styles.weekdayText, { width: cellSize }]}>
                    {label}
                  </Text>
                ))}
              </View>
              <View style={styles.calendarMonthGrid}>
                {month.weeks.map((week, weekIndex) => (
                  <View key={`${month.key}-${weekIndex}`} style={styles.calendarWeekRow}>
                    {week.map((day, dayIndex) =>
                      day ? (
                        <ReportCalendarDayCell
                          cellSize={cellSize}
                          day={day}
                          key={day.date}
                          onPress={setSelectedDay}
                          todayDateKey={todayDateKey}
                        />
                      ) : (
                        <View
                          key={`${month.key}-${weekIndex}-${dayIndex}`}
                          style={[styles.calendarDayPlaceholder, { height: cellSize, width: cellSize }]}
                        />
                      ),
                    )}
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      {months.length > 1 ? (
        <View style={styles.monthIndicatorRow}>
          {months.map((month, index) => (
            <View
              key={month.key}
              style={[styles.monthIndicatorDot, index === selectedMonthIndex ? styles.monthIndicatorDotActive : null]}
            />
          ))}
        </View>
      ) : null}
      <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />
    </View>
  );
}

function ReportCalendarDayCell({
  cellSize,
  day,
  onPress,
  todayDateKey,
}: {
  cellSize: number;
  day: AdvancedReportDay;
  onPress: (day: AdvancedReportDay) => void;
  todayDateKey: string;
}) {
  const { colors } = useAppTheme();
  const styles = createAdvancedCalendarStyles(colors);
  const hasRecord = hasAnyDayRecord(day);
  const isToday = day.date === todayDateKey;

  return (
    <Pressable
      accessibilityLabel={`${formatDateLabel(day.date)} ${formatDayAccessibility(day)}`}
      accessibilityHint="查看当天低敏详情"
      accessibilityRole="button"
      accessible
      onPress={() => onPress(day)}
      style={({ pressed }) => [
        styles.calendarDayCell,
        { height: cellSize, width: cellSize },
        hasRecord ? styles.calendarDayCellActive : styles.calendarDayCellQuiet,
        isToday ? styles.calendarTodayCell : null,
        pressed ? styles.calendarDayCellPressed : null,
      ]}
    >
      <Text
        style={[
          styles.calendarDayNumber,
          hasRecord ? null : styles.calendarDayNumberMuted,
          isToday ? styles.calendarTodayNumber : null,
        ]}
      >
        {Number(day.date.slice(-2))}
      </Text>
      <View style={styles.dayDotRow}>
        <View style={[styles.dayDot, { backgroundColor: getTrainingDotColor(colors, day) }]} />
        <View style={[styles.dayDot, { backgroundColor: getHabitDotColor(colors, day) }]} />
        <View style={[styles.dayDot, { backgroundColor: getToiletDotColor(colors, day) }]} />
      </View>
    </Pressable>
  );
}

function DayDetailModal({ day, onClose }: { day: AdvancedReportDay | null; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = createAdvancedCalendarStyles(colors);
  if (!day) return null;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.dayDetailOverlay}>
        <Pressable
          accessibilityLabel="关闭日期详情"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.dayDetailBackdrop}
        />
        <View accessibilityLabel={`${formatFullDateLabel(day.date)} 低敏记录详情`} style={styles.dayDetailCard}>
          <View style={styles.dayDetailHeader}>
            <View>
              <Text style={styles.dayDetailTitle}>{formatFullDateLabel(day.date)}</Text>
              <Text style={styles.dayDetailCaption}>当天低敏记录</Text>
            </View>
            <Pressable
              accessibilityLabel="关闭"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.dayDetailCloseButton}
            >
              <Text style={styles.dayDetailCloseText}>关闭</Text>
            </Pressable>
          </View>
          <View style={styles.dayDetailRows}>
            <DayDetailRow color={colors.primary} label="菊花抬" value={day.trainingDone ? '已完成' : '未完成'} />
            <DayDetailRow color={colors.info} label="小账本" value={formatHabitStatus(day)} />
            <DayDetailRow color={colors.warning} label="蹲会儿" value={formatToiletStatus(day)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DayDetailRow({ color, label, value }: { color: string; label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = createAdvancedCalendarStyles(colors);
  return (
    <View style={styles.dayDetailRow}>
      <View style={[styles.dayDetailRowDot, { backgroundColor: color }]} />
      <Text style={styles.dayDetailRowLabel}>{label}</Text>
      <Text style={styles.dayDetailRowValue}>{value}</Text>
    </View>
  );
}

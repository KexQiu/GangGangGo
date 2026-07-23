import type { AdvancedReportDay } from '@xiaotidu/contracts';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { routes } from '../../../navigation/routes';
import { AppSheet } from '../../../components/AppSheet';
import { useAppTheme } from '../../../theme/themeProvider';
import { getLocalDateKey } from '../../habits/habitLogic';
import { formatToiletDuration } from '../../toilet/toiletLogic';
import { getToiletStoolColorLabel, getToiletStoolShapeLabel } from '../../toilet/toiletRecordLogic';
import { type ToiletSession } from '../../toilet/toiletTypes';
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

export function ReportCalendarGrid({
  days,
  toiletSessions = [],
}: {
  days: AdvancedReportDay[];
  toiletSessions?: ToiletSession[];
}) {
  const { colors } = useAppTheme();
  const styles = createAdvancedCalendarStyles(colors);
  const scrollViewRef = useRef<ScrollView>(null);
  const months = useMemo(() => buildCalendarMonths(days), [days]);
  const todayDateKey = useMemo(() => getTodayDateKey(), []);
  const defaultMonthIndex = useMemo(() => getDefaultMonthIndex(months, todayDateKey), [months, todayDateKey]);
  const sessionsByDate = useMemo(() => groupToiletSessionsByDate(toiletSessions), [toiletSessions]);
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
      <DayDetailModal
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
        toiletSessions={selectedDay ? (sessionsByDate.get(selectedDay.date) ?? []) : []}
      />
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
      accessibilityHint="查看当天记录"
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

function DayDetailModal({
  day,
  onClose,
  toiletSessions,
}: {
  day: AdvancedReportDay | null;
  onClose: () => void;
  toiletSessions: ToiletSession[];
}) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createAdvancedCalendarStyles(colors);
  const lastPresentedDay = useRef<AdvancedReportDay | null>(day);
  if (day) lastPresentedDay.current = day;
  const displayedDay = day ?? lastPresentedDay.current;

  if (!displayedDay) return null;

  return (
    <AppSheet
      accessibilityLabel="关闭日期详情"
      contentContainerStyle={styles.dayDetailContent}
      onClose={onClose}
      presentation="dialog"
      subtitle="当天低敏记录与本机明细"
      title={formatFullDateLabel(displayedDay.date)}
      visible={Boolean(day)}
    >
      {day ? (
        <>
          <View style={styles.dayDetailRows}>
            <DayDetailRow
              color={colors.primary}
              label="菊花抬"
              value={displayedDay.trainingDone ? '已完成' : '未完成'}
            />
            <DayDetailRow color={colors.info} label="小账本" value={formatHabitStatus(displayedDay)} />
            <DayDetailRow color={colors.warning} label="蹲会儿" value={formatToiletStatus(displayedDay)} />
          </View>

          <View style={styles.toiletDetailSection}>
            <Text style={styles.toiletDetailTitle}>蹲会儿明细</Text>
            <Text style={styles.toiletDetailCaption}>以下内容仅保存在本机。</Text>
            {toiletSessions.length > 0 ? (
              toiletSessions.map((session) => (
                <ToiletSessionRow
                  key={session.id}
                  onPress={() => {
                    onClose();
                    router.push(routes.toiletRecord(session.id));
                  }}
                  session={session}
                />
              ))
            ) : (
              <Text style={styles.toiletDetailEmpty}>当天没有可查看的蹲会儿明细。</Text>
            )}
          </View>
        </>
      ) : null}
    </AppSheet>
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

function ToiletSessionRow({ onPress, session }: { onPress: () => void; session: ToiletSession }) {
  const { colors } = useAppTheme();
  const styles = createAdvancedCalendarStyles(colors);
  const details = [
    getToiletFeelingLabel(session.feeling),
    getToiletStoolShapeLabel(session.stoolShape),
    getToiletStoolColorLabel(session.stoolColor),
  ].filter((value): value is string => Boolean(value));
  const signalLabels = session.signals?.map((signal) => signal.label) ?? [];
  if (session.discomfort) signalLabels.push('明显不舒服');
  if (session.bleeding) signalLabels.push('明显便血');

  return (
    <Pressable
      accessibilityHint="查看并编辑本次记录"
      accessibilityLabel={`${formatToiletSessionTime(session.endedAt)}，用时 ${formatToiletDuration(session.durationSeconds)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.toiletSessionRow, pressed ? styles.toiletSessionRowPressed : null]}
    >
      <View style={styles.toiletSessionHeader}>
        <Text style={styles.toiletSessionTime}>{formatToiletSessionTime(session.endedAt)}</Text>
        <Text style={styles.toiletSessionDuration}>{formatToiletDuration(session.durationSeconds)}</Text>
        <ChevronRight color={colors.textSubtle} size={18} strokeWidth={2.4} />
      </View>
      <Text style={styles.toiletSessionSummary}>{details.length > 0 ? details.join(' · ') : '未填写排便详情'}</Text>
      {signalLabels.length > 0 ? (
        <View style={styles.toiletSignalGrid}>
          {signalLabels.map((label) => (
            <View key={label} style={styles.toiletSignalChip}>
              <Text style={styles.toiletSignalText}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function groupToiletSessionsByDate(toiletSessions: ToiletSession[]) {
  const sessionsByDate = new Map<string, ToiletSession[]>();

  for (const session of toiletSessions) {
    const date = getLocalDateKey(new Date(session.endedAt));
    const sessions = sessionsByDate.get(date) ?? [];
    sessions.push(session);
    sessionsByDate.set(date, sessions);
  }

  for (const sessions of sessionsByDate.values()) {
    sessions.sort((left, right) => right.endedAt.localeCompare(left.endedAt));
  }

  return sessionsByDate;
}

function formatToiletSessionTime(value: string) {
  const date = new Date(value);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function getToiletFeelingLabel(feeling: ToiletSession['feeling']) {
  const labels = {
    difficult: '困难',
    normal: '一般',
    smooth: '顺畅',
  };
  return labels[feeling];
}

import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertTriangle,
  BookOpenCheck,
  ChartNoAxesColumnIncreasing,
  Crown,
  Hourglass,
  RefreshCw,
} from 'lucide-react-native';
import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AdvancedReportDay, AdvancedReportResponse } from '@xiaotidu/contracts';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { PageSection, PageStack } from '../../src/components/PageStack';
import { Screen } from '../../src/components/Screen';
import { isProStatus, useAuthStore } from '../../src/features/account/authStore';
import { useAdvancedReportQuery } from '../../src/features/reports/reportQueries';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

const calendarColumnGap = 5;
const calendarFallbackCellSize = 36;
const calendarMinimumCellSize = 30;
const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];

export default function AdvancedReportScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const proStatus = useAuthStore((state) => state.proStatus);
  const user = useAuthStore((state) => state.user);
  const isPro = isProStatus(proStatus);
  const {
    data: advancedReport,
    isFetching: isLoading,
    refetch: refetchAdvancedReport,
  } = useAdvancedReportQuery({
    enabled: isPro,
  });

  useFocusEffect(
    useCallback(() => {
      if (isPro) {
        void refetchAdvancedReport();
      }
    }, [isPro, refetchAdvancedReport]),
  );

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.trends} title="90 天回看" />
      <PageHeader
        eyebrow="Pro 高级小报告"
        subtitle="看更长周期的低敏趋势，不做排名，也不做健康评分。"
        title="90 天节奏慢慢看"
      />

      <PageStack gap="regular">
        {!user ? (
          <AppCard style={styles.noticeCard}>
            <Crown color={colors.primaryPressed} size={28} strokeWidth={2.4} />
            <Text style={styles.noticeTitle}>先登录小提督</Text>
            <Text style={styles.noticeBody}>登录后才能刷新云端摘要和查看 Pro 高级小报告。</Text>
            <AppButton onPress={() => router.push(routes.me)}>去登录</AppButton>
          </AppCard>
        ) : null}

        {user && !isPro ? (
          <AppCard style={styles.noticeCard}>
            <Crown color={colors.primaryPressed} size={28} strokeWidth={2.4} />
            <Text style={styles.noticeTitle}>90 天回看在 Pro 里</Text>
            <Text style={styles.noticeBody}>基础小报告继续免费。Pro 会补上更长周期，但仍只使用低敏摘要。</Text>
            <AppButton onPress={() => router.push(routes.pro)}>了解 Pro</AppButton>
          </AppCard>
        ) : null}

        {user && isPro ? (
          <>
            <AppCard muted style={styles.headerCard}>
              <View style={styles.headerTopRow}>
                <View style={styles.headerBadge}>
                  <ChartNoAxesColumnIncreasing color={colors.primaryPressed} size={15} strokeWidth={2.5} />
                  <Text style={styles.headerBadgeText}>Pro 90 天</Text>
                </View>
                <View style={styles.headerStatus}>
                  <RefreshCw color={isLoading ? colors.primary : colors.textSubtle} size={15} strokeWidth={2.4} />
                  <Text style={[styles.headerStatusText, isLoading ? styles.headerStatusTextActive : null]}>
                    {isLoading ? '刷新中' : '低敏摘要'}
                  </Text>
                </View>
              </View>
              <Text style={styles.headerTitle}>
                {advancedReport ? formatReportRange(advancedReport) : '正在准备 90 天数据'}
              </Text>
              <Text style={styles.headerBody}>
                {isLoading ? '正在同步本机低敏日报，再读取云端回看。' : '数据来自本机低敏日报，云端只保存聚合结果。'}
              </Text>
            </AppCard>

            {!advancedReport && isLoading ? (
              <AppCard style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>90 天摘要刷新中...</Text>
                <Text style={styles.noticeBody}>正在先同步本机低敏日报，再读取云端 90 天回看。</Text>
              </AppCard>
            ) : advancedReport?.summary.hasAnyRecord ? (
              <>
                <View style={styles.summaryGrid}>
                  <SummaryTile
                    icon={ChartNoAxesColumnIncreasing}
                    label="小花训练达标"
                    tone="primary"
                    value={`${advancedReport.summary.trainingDays} 天`}
                  />
                  <SummaryTile
                    icon={BookOpenCheck}
                    label="小账本满格"
                    tone="primary"
                    value={`${advancedReport.summary.habitFullDays} 天`}
                  />
                  <SummaryTile
                    icon={Hourglass}
                    label="蹲会儿长会"
                    tone="warning"
                    value={`${advancedReport.summary.toiletLongMeetingCount} 次`}
                  />
                  <SummaryTile
                    icon={RefreshCw}
                    label="有记录"
                    tone="info"
                    value={`${advancedReport.summary.recordDays} 天`}
                  />
                </View>

                <PageSection subtitle="按月份看每天的小状态，点点只代表低敏记录。" title="90 天节奏图">
                  <AppCard style={styles.calendarCard}>
                    <ReportCalendarGrid days={advancedReport.days} />
                    <View style={styles.legendRow}>
                      <LegendDot color={colors.primary} label="菊花抬" />
                      <LegendDot color={colors.info} label="小账本" />
                      <LegendDot color={colors.warning} label="蹲会儿" />
                    </View>
                  </AppCard>
                </PageSection>

                <PageSection title="这段时间的线索">
                  <InsightCard report={advancedReport} />
                </PageSection>
              </>
            ) : (
              <AppCard style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>90 天还在等第一笔</Text>
                <Text style={styles.noticeBody}>
                  完成今天的本地记录后会自动同步。这里不会上传便血、不适、排便感受或具体蹲会儿时长。
                </Text>
              </AppCard>
            )}
          </>
        ) : null}
      </PageStack>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];
type SummaryTone = 'info' | 'primary' | 'warning';
type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;
type CalendarDayCell = AdvancedReportDay | null;
type CalendarMonth = {
  key: string;
  title: string;
  weeks: CalendarDayCell[][];
};

function SummaryTile({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: IconComponent;
  label: string;
  tone: SummaryTone;
  value: string;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const color = getToneColor(colors, tone);

  return (
    <View style={[styles.summaryTile, { borderColor: color }]}>
      <View style={styles.summaryTileHeader}>
        <Icon color={color} size={16} strokeWidth={2.4} />
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

function ReportCalendarGrid({ days }: { days: AdvancedReportDay[] }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
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
      if (calendarWidth <= 0) {
        return;
      }

      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / calendarWidth);
      setSelectedMonthIndex(Math.max(0, Math.min(months.length - 1, nextIndex)));
    },
    [calendarWidth, months.length],
  );

  useEffect(() => {
    setSelectedMonthIndex(defaultMonthIndex);
  }, [defaultMonthIndex, monthsKey]);

  useEffect(() => {
    if (calendarWidth <= 0 || months.length === 0) {
      return;
    }

    scrollViewRef.current?.scrollTo({
      animated: false,
      x: selectedMonthIndex * calendarWidth,
      y: 0,
    });
  }, [calendarWidth, months.length, selectedMonthIndex]);
  const handleCloseDayDetail = useCallback(() => {
    setSelectedDay(null);
  }, []);

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
      <DayDetailModal day={selectedDay} onClose={handleCloseDayDetail} />
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
  const styles = createStyles(colors);
  const hasRecord = hasAnyDayRecord(day);
  const isToday = day.date === todayDateKey;
  const dayNumber = Number(day.date.slice(-2));

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
        {dayNumber}
      </Text>
      <View style={styles.dayDotRow}>
        <View
          style={[
            styles.dayDot,
            {
              backgroundColor: getTrainingDotColor(colors, day),
            },
          ]}
        />
        <View
          style={[
            styles.dayDot,
            {
              backgroundColor: getHabitDotColor(colors, day),
            },
          ]}
        />
        <View
          style={[
            styles.dayDot,
            {
              backgroundColor: getToiletDotColor(colors, day),
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

function DayDetailModal({ day, onClose }: { day: AdvancedReportDay | null; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  if (!day) {
    return null;
  }

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
  const styles = createStyles(colors);

  return (
    <View style={styles.dayDetailRow}>
      <View style={[styles.dayDetailRowDot, { backgroundColor: color }]} />
      <Text style={styles.dayDetailRowLabel}>{label}</Text>
      <Text style={styles.dayDetailRowValue}>{value}</Text>
    </View>
  );
}

function InsightCard({ report }: { report: AdvancedReportResponse }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const insight = getInsight(report);
  const isWarning = insight.tone === 'warning';

  return (
    <AppCard style={styles.insightCard}>
      {isWarning ? (
        <AlertTriangle color={colors.warning} size={23} strokeWidth={2.4} />
      ) : (
        <ChartNoAxesColumnIncreasing color={colors.primaryPressed} size={23} strokeWidth={2.4} />
      )}
      <View style={styles.insightCopy}>
        <Text style={styles.insightTitle}>{insight.title}</Text>
        <Text style={styles.noticeBody}>{insight.body}</Text>
      </View>
    </AppCard>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function getInsight(report: AdvancedReportResponse) {
  const { summary } = report;

  if (summary.toiletLongMeetingCount >= 3) {
    return {
      body: `90 天里有 ${summary.toiletLongMeetingCount} 次蹲会儿长会。知道就好，下次早点散会，身体不舒服时先看小花说明书。`,
      title: '长会有点多，先留意',
      tone: 'warning' as const,
    };
  }

  if (summary.trainingDays >= 45 && summary.habitFullDays >= 45) {
    return {
      body: '小花训练达标和小账本都保持了不少天，节奏已经很清楚。继续轻轻来就好。',
      title: '90 天节奏很稳',
      tone: 'primary' as const,
    };
  }

  if (summary.trainingDays >= 15 && summary.trainingDays >= summary.habitFullDays) {
    return {
      body: `小花训练达标 ${summary.trainingDays} 天，身体活动这条线已经先跑起来了。`,
      title: '小花有在营业',
      tone: 'primary' as const,
    };
  }

  if (summary.habitFullDays > 0) {
    return {
      body: `小账本满格 ${summary.habitFullDays} 天，习惯线索开始变得完整。`,
      title: '小账本有线索',
      tone: 'primary' as const,
    };
  }

  return {
    body: `90 天里有 ${summary.recordDays} 天留下记录。先不用追求满格，持续出现就算开始。`,
    title: '已经开始有记录',
    tone: 'primary' as const,
  };
}

function getToneColor(colors: ThemeColors, tone: SummaryTone) {
  if (tone === 'warning') {
    return colors.warning;
  }

  if (tone === 'info') {
    return colors.info;
  }

  return colors.primary;
}

function getTrainingDotColor(colors: ThemeColors, day: AdvancedReportDay) {
  return day.trainingDone ? colors.primary : 'transparent';
}

function getHabitDotColor(colors: ThemeColors, day: AdvancedReportDay) {
  return day.habitFull || day.habitCompletion > 0 ? colors.info : 'transparent';
}

function getToiletDotColor(colors: ThemeColors, day: AdvancedReportDay) {
  return day.toiletRecorded || day.toiletLongMeeting ? colors.warning : 'transparent';
}

function hasAnyDayRecord(day: AdvancedReportDay) {
  return day.trainingDone || day.habitFull || day.habitCompletion > 0 || day.toiletRecorded || day.toiletLongMeeting;
}

function buildCalendarMonths(days: AdvancedReportDay[]): CalendarMonth[] {
  const sortedDays = [...days].sort((left, right) => left.date.localeCompare(right.date));
  const dayByDate = new Map(days.map((day) => [day.date, day]));
  const monthKeys = Array.from(new Set(sortedDays.map((day) => getMonthKey(day.date))));

  return monthKeys.map((monthKey) => {
    const { month, year } = parseMonthKey(monthKey);
    const monthDays = sortedDays.filter((day) => getMonthKey(day.date) === monthKey);
    const firstDayNumber = Number(monthDays[0]?.date.slice(-2) ?? 1);
    const lastDayNumber = Number(monthDays[monthDays.length - 1]?.date.slice(-2) ?? firstDayNumber);
    const firstVisibleDate = new Date(year, month - 1, firstDayNumber);
    const cells: CalendarDayCell[] = Array.from({ length: getMondayWeekdayIndex(firstVisibleDate) }, () => null);

    for (let dayNumber = firstDayNumber; dayNumber <= lastDayNumber; dayNumber += 1) {
      cells.push(dayByDate.get(formatDateKey(year, month, dayNumber)) ?? null);
    }

    const trailingEmptyCount = (7 - (cells.length % 7)) % 7;
    cells.push(...Array.from({ length: trailingEmptyCount }, () => null));

    return {
      key: monthKey,
      title: formatMonthTitle(monthKey),
      weeks: chunkCalendarWeeks(cells),
    };
  });
}

function chunkCalendarWeeks(cells: CalendarDayCell[]) {
  const weeks: CalendarDayCell[][] = [];

  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
}

function parseMonthKey(monthKey: string) {
  const [year = '0', month = '1'] = monthKey.split('-');

  return {
    month: Number(month),
    year: Number(year),
  };
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function getMondayWeekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function getDefaultMonthIndex(months: CalendarMonth[], todayDateKey: string) {
  const todayMonthKey = getMonthKey(todayDateKey);
  const todayMonthIndex = months.findIndex((month) => month.key === todayMonthKey);

  return todayMonthIndex >= 0 ? todayMonthIndex : Math.max(0, months.length - 1);
}

function getCalendarCellSize(containerWidth: number) {
  if (containerWidth <= 0) {
    return calendarFallbackCellSize;
  }

  const availableCellSize = (containerWidth - calendarColumnGap * (weekdayLabels.length - 1)) / weekdayLabels.length;

  return Math.max(calendarMinimumCellSize, availableCellSize);
}

function getTodayDateKey() {
  const now = new Date();

  return formatDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatMonthTitle(monthKey: string) {
  const [year = '', month = ''] = monthKey.split('-');

  return `${Number(year)} 年 ${Number(month)} 月`;
}

function formatFullDateLabel(dateKey: string) {
  const [year = '', month = '', day = ''] = dateKey.split('-');

  return `${Number(year)}. ${Number(month)}. ${Number(day)}`;
}

function formatReportRange(report: AdvancedReportResponse) {
  return `${formatDateLabel(report.startedAt)} - ${formatDateLabel(report.endedAt)}`;
}

function formatDateLabel(dateKey: string) {
  const [, month = '', day = ''] = dateKey.split('-');

  return `${Number(month)}. ${Number(day)}`;
}

function formatDayAccessibility(day: AdvancedReportDay) {
  const parts = [
    day.trainingDone ? '菊花抬完成' : '菊花抬未完成',
    day.habitFull ? '小账本满格' : `小账本 ${day.habitCompletion}/4`,
    day.toiletLongMeeting ? '蹲会儿长会' : day.toiletRecorded ? '蹲会儿已记录' : '蹲会儿未记录',
  ];

  return parts.join('，');
}

function formatHabitStatus(day: AdvancedReportDay) {
  if (day.habitFull || day.habitCompletion >= 4) {
    return `满格 ${day.habitCompletion}/4`;
  }

  if (day.habitCompletion > 0) {
    return `已记 ${day.habitCompletion}/4`;
  }

  return '未记录';
}

function formatToiletStatus(day: AdvancedReportDay) {
  if (day.toiletLongMeeting) {
    return '长会';
  }

  if (day.toiletRecorded) {
    return '已记录';
  }

  return '未记录';
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    calendarCard: {
      padding: 16,
    },
    calendarDayCell: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexShrink: 0,
      gap: 4,
      justifyContent: 'center',
      overflow: 'hidden',
      paddingHorizontal: 2,
      paddingVertical: 4,
    },
    calendarDayCellActive: {
      backgroundColor: colors.surface,
    },
    calendarDayCellPressed: {
      transform: [{ scale: 0.97 }],
    },
    calendarDayCellQuiet: {
      backgroundColor: colors.surfaceMuted,
    },
    calendarDayNumber: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 15,
      textAlign: 'center',
    },
    calendarDayNumberMuted: {
      color: colors.textSubtle,
      fontWeight: '700',
    },
    calendarDayPlaceholder: {
      flexShrink: 0,
    },
    calendarGrid: {
      gap: 14,
    },
    calendarMonth: {
      gap: 8,
    },
    calendarMonthGrid: {
      gap: calendarColumnGap,
    },
    calendarMonthTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    calendarMonthPage: {
      flexShrink: 0,
    },
    calendarPager: {
      overflow: 'hidden',
    },
    calendarTodayCell: {
      borderColor: colors.primaryPressed,
      borderWidth: 2,
    },
    calendarTodayNumber: {
      color: colors.primaryPressed,
      fontWeight: '900',
    },
    calendarWeekRow: {
      flexDirection: 'row',
      gap: calendarColumnGap,
    },
    dayDot: {
      borderRadius: 3,
      height: 5,
      width: 5,
    },
    dayDotRow: {
      flexDirection: 'row',
      gap: 3,
    },
    dayDetailBackdrop: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    dayDetailCaption: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
      marginTop: 3,
    },
    dayDetailCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 16,
      maxWidth: 360,
      padding: 18,
      width: '100%',
    },
    dayDetailCloseButton: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    dayDetailCloseText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 17,
    },
    dayDetailHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
    },
    dayDetailOverlay: {
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.52)',
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    dayDetailRow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 9,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    dayDetailRowDot: {
      borderRadius: 5,
      height: 10,
      width: 10,
    },
    dayDetailRowLabel: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: '900',
      lineHeight: 18,
    },
    dayDetailRows: {
      gap: 8,
    },
    dayDetailRowValue: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
    },
    dayDetailTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 27,
    },
    emptyCard: {
      gap: 8,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    headerBody: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    headerBadge: {
      alignItems: 'center',
      flexDirection: 'row',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    headerBadgeText: {
      color: colors.primaryPressed,
      fontSize: 12,
      fontWeight: '900',
      lineHeight: 15,
    },
    headerCard: {
      gap: 9,
    },
    headerStatus: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    headerStatusText: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 15,
    },
    headerStatusTextActive: {
      color: colors.primary,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 27,
    },
    headerTopRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    insightCard: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
    },
    insightCopy: {
      flex: 1,
    },
    insightTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      marginBottom: 5,
    },
    legendDot: {
      borderRadius: 4,
      height: 8,
      width: 8,
    },
    legendItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 14,
    },
    legendText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    monthIndicatorDot: {
      backgroundColor: colors.border,
      borderRadius: 4,
      height: 7,
      width: 7,
    },
    monthIndicatorDotActive: {
      backgroundColor: colors.primary,
      width: 18,
    },
    monthIndicatorRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
    },
    noticeBody: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
    },
    noticeCard: {
      alignItems: 'center',
      gap: 12,
    },
    noticeTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 15,
    },
    summaryTile: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      flexBasis: '47%',
      flexGrow: 1,
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    summaryTileHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: '900',
      lineHeight: 24,
    },
    weekdayRow: {
      flexDirection: 'row',
      gap: calendarColumnGap,
    },
    weekdayText: {
      color: colors.textSubtle,
      flexShrink: 0,
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 14,
      textAlign: 'center',
    },
  });
}

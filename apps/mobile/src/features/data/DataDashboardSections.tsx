import type { DailyActivitySummary } from '@xiaotidu/contracts';
import { Crown, Database, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { useAppTheme } from '../../theme/themeProvider';
import { getToiletStoolColorLabel, getToiletStoolShapeLabel } from '../toilet/toiletRecordLogic';
import type { ToiletSession } from '../toilet/toiletTypes';
import { getTrainingPreset } from '../training/presets';
import type { DailyDataDetails } from './dailyData';
import {
  buildDataTrendModel,
  formatTrendAxisValue,
  formatTrendShortDate,
  formatTrendValue,
  getTrendSelectionIndex,
  shouldCaptureTrendGesture,
  trendChartFrame,
  trendMetricLabel,
  type TrendCategory,
  type TrendRange,
} from './dataTrendPresentation';
import { createDataStyles } from './styles/dataStyles';

export { DailyDataCalendar } from './DailyDataCalendar';

const detailSheetEnterTranslateY = 96;

export function TodayDataOverview({ summary }: { summary: DailyActivitySummary }) {
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);
  return (
    <AppCard muted style={styles.todayCard}>
      <View style={styles.todayTop}>
        <View style={styles.todayIcon}>
          <Database color={colors.primaryPressed} size={19} strokeWidth={2.4} />
        </View>
        <View>
          <Text style={styles.todayTitle}>今日总览</Text>
          <Text style={styles.todayDate}>{formatFullDate(summary.date)}</Text>
        </View>
      </View>
      <View style={styles.todayMetrics}>
        <Metric
          hint={`${formatMinutes(summary.training.totalDurationSeconds)} 分钟`}
          label="菊花抬"
          value={`${summary.training.completedSessionCount} 次`}
        />
        <Metric hint={formatHabitSummary(summary)} label="小账本" value={`${summary.habit.completionCount}/4 项`} />
        <Metric
          hint={
            summary.toilet.attentionCount > 0
              ? `${summary.toilet.attentionCount} 次需留意`
              : `${formatMinutes(summary.toilet.totalDurationSeconds)} 分钟`
          }
          label="蹲会儿"
          value={`${summary.toilet.sessionCount} 次`}
        />
      </View>
    </AppCard>
  );
}

function Metric({ hint, label, value }: { hint: string; label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricHint}>
        {hint}
      </Text>
    </View>
  );
}

export function ProDataGate({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);
  return (
    <AppCard style={styles.gateCard}>
      <Crown color={colors.warning} size={24} strokeWidth={2.3} />
      <Text style={styles.gateTitle}>90 天日历在 Pro 里</Text>
      <Text style={styles.gateText}>完整数据会继续为登录账号同步。升级后可按日期回看 90 天明细和长期折线。</Text>
      <AppButton onPress={onPress} variant="secondary">
        了解 Pro
      </AppButton>
    </AppCard>
  );
}

export function DataTrendChart({
  isPro,
  onGestureActiveChange,
  onOpenDate,
  onRequestPro,
  onSelectDate,
  selectedDate,
  summaries,
}: {
  isPro: boolean;
  onGestureActiveChange: (active: boolean) => void;
  onOpenDate: (date: string) => void;
  onRequestPro: () => void;
  onSelectDate: (date: string) => void;
  selectedDate: string;
  summaries: DailyActivitySummary[];
}) {
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);
  const [range, setRange] = useState<TrendRange>(7);
  const [category, setCategory] = useState<TrendCategory>('toilet');
  const [selected, setSelected] = useState(6);
  const chartRef = useRef<View>(null);
  const chartPageXRef = useRef(0);
  const widthRef = useRef(1);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const model = useMemo(() => buildDataTrendModel(summaries, range, category), [category, range, summaries]);
  const selectedIndex = Math.max(0, Math.min(selected, model.points.length - 1));
  const selectedSummary = model.days[selectedIndex];
  const selectedPoint = model.points[selectedIndex];
  const updateSelection = useCallback(
    (x: number, commit = false) => {
      const index = getTrendSelectionIndex(x, widthRef.current, model.points.length);
      if (index !== selectedRef.current) {
        selectedRef.current = index;
        setSelected(index);
      }
      const date = model.days[index]?.date;
      if (commit && date) onSelectDate(date);
    },
    [model.days, model.points.length, onSelectDate],
  );
  const measureChartPosition = useCallback(() => {
    chartRef.current?.measureInWindow((x) => {
      chartPageXRef.current = x;
    });
  }, []);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => shouldCaptureTrendGesture(gestureState.dx, gestureState.dy),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          shouldCaptureTrendGesture(gestureState.dx, gestureState.dy),
        onPanResponderGrant: (_, gestureState) => {
          onGestureActiveChange(true);
          updateSelection(gestureState.moveX - chartPageXRef.current);
        },
        onPanResponderMove: (_, gestureState) => updateSelection(gestureState.moveX - chartPageXRef.current),
        onPanResponderRelease: (_, gestureState) => {
          onGestureActiveChange(false);
          updateSelection(gestureState.moveX - chartPageXRef.current, true);
        },
        onPanResponderTerminate: (_, gestureState) => {
          onGestureActiveChange(false);
          updateSelection(gestureState.moveX - chartPageXRef.current, true);
        },
        onPanResponderTerminationRequest: () => true,
        onShouldBlockNativeResponder: () => false,
      }),
    [onGestureActiveChange, updateSelection],
  );
  useEffect(() => () => onGestureActiveChange(false), [onGestureActiveChange]);
  useEffect(() => {
    const summaryIndex = summaries.findIndex((summary) => summary.date === selectedDate);
    if (summaryIndex < 0) return;
    const daysAgo = summaries.length - 1 - summaryIndex;
    const requiredRange: TrendRange = daysAgo < 7 ? 7 : daysAgo < 30 ? 30 : 90;
    if (requiredRange > range && (requiredRange !== 90 || isPro)) setRange(requiredRange);
  }, [isPro, range, selectedDate, summaries]);
  useEffect(() => {
    const index = model.days.findIndex((summary) => summary.date === selectedDate);
    if (index < 0 || index === selectedRef.current) return;
    selectedRef.current = index;
    setSelected(index);
  }, [model.days, selectedDate]);
  const setChartRange = (next: TrendRange) => {
    if (next === 90 && !isPro) {
      onRequestPro();
      return;
    }
    const nextDays = summaries.slice(-next);
    const nextIndex = nextDays.findIndex((summary) => summary.date === selectedDate);
    const resolvedIndex = nextIndex >= 0 ? nextIndex : Math.max(0, nextDays.length - 1);
    const nextDate = nextDays[resolvedIndex]?.date;
    setRange(next);
    selectedRef.current = resolvedIndex;
    setSelected(resolvedIndex);
    if (nextDate) onSelectDate(nextDate);
  };
  return (
    <AppCard style={styles.chartCard}>
      <Segments
        items={[7, 30, 90] as TrendRange[]}
        label={(item) => `${item} 天`}
        disabled={(item) => item === 90 && !isPro}
        onSelect={setChartRange}
        selected={range}
      />
      <View style={styles.categorySegments}>
        <Segments
          items={['training', 'habit', 'toilet'] as TrendCategory[]}
          label={(item) => ({ training: '菊花抬', habit: '小账本', toilet: '蹲会儿' })[item]}
          onSelect={(item) => {
            setCategory(item);
          }}
          selected={category}
        />
      </View>
      <View style={styles.chartValueRow}>
        <View style={styles.chartValueCopy}>
          <Text numberOfLines={1} style={styles.chartValue}>
            {formatTrendValue(selectedPoint?.rawValue ?? null, category)}
          </Text>
          <Text numberOfLines={1} style={styles.chartDate}>
            {selectedSummary ? `${formatFullDate(selectedSummary.date)} · ${trendMetricLabel(category)}` : '暂无记录'}
          </Text>
        </View>
        {selectedSummary ? (
          <Pressable
            accessibilityLabel={`查看 ${formatFullDate(selectedSummary.date)} 的详情`}
            hitSlop={8}
            onPress={() => onOpenDate(selectedSummary.date)}
            style={styles.chartDetailAction}
          >
            <Text numberOfLines={1} style={styles.chartDetailActionText}>
              查看详情
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View
        collapsable={false}
        onLayout={(event) => {
          widthRef.current = event.nativeEvent.layout.width;
          measureChartPosition();
        }}
        onTouchStart={measureChartPosition}
        ref={chartRef}
        style={styles.chartCanvas}
        {...panResponder.panHandlers}
      >
        <Pressable
          accessibilityActions={[
            { label: '前一天', name: 'decrement' },
            { label: '后一天', name: 'increment' },
          ]}
          accessibilityLabel={`${{ training: '菊花抬', habit: '小账本', toilet: '蹲会儿' }[category]}趋势图`}
          accessibilityRole="adjustable"
          accessibilityValue={{
            text: selectedSummary
              ? `${formatFullDate(selectedSummary.date)}，${formatTrendValue(selectedPoint?.rawValue ?? null, category)}`
              : '暂无记录',
          }}
          onAccessibilityAction={(event) => {
            const action = event.nativeEvent.actionName;
            if (model.points.length === 0 || (action !== 'increment' && action !== 'decrement')) return;
            const offset = action === 'increment' ? 1 : -1;
            const next = Math.max(0, Math.min(model.points.length - 1, selectedRef.current + offset));
            selectedRef.current = next;
            setSelected(next);
            const date = model.days[next]?.date;
            if (date) onSelectDate(date);
          }}
          onPress={(event) => updateSelection(event.nativeEvent.locationX, true)}
          style={styles.chartPressTarget}
        >
          <Svg height="100%" viewBox={`0 0 ${trendChartFrame.width} ${trendChartFrame.height}`} width="100%">
            {model.yTicks.map((tick) => (
              <Line
                key={`grid-${tick.value}`}
                stroke={colors.border}
                strokeDasharray={tick.value === 0 ? undefined : '4 5'}
                strokeWidth="1"
                x1={trendChartFrame.plotLeft}
                x2={trendChartFrame.plotRight}
                y1={tick.y}
                y2={tick.y}
              />
            ))}
            {model.yTicks.map((tick) => (
              <SvgText
                fill={colors.textSubtle}
                fontSize="9"
                key={`y-label-${tick.value}`}
                textAnchor="end"
                x={trendChartFrame.plotLeft - 6}
                y={tick.y + 3}
              >
                {formatTrendAxisValue(tick.value, category)}
              </SvgText>
            ))}
            {category === 'toilet' ? (
              <>
                <Line
                  stroke={colors.warning}
                  strokeDasharray="5 4"
                  strokeWidth="1.5"
                  x1={trendChartFrame.plotLeft}
                  x2={trendChartFrame.plotRight}
                  y1={toiletReferenceY(model.yMax)}
                  y2={toiletReferenceY(model.yMax)}
                />
                <SvgText
                  fill={colors.warning}
                  fontSize="9"
                  fontWeight="700"
                  textAnchor="end"
                  x={trendChartFrame.plotRight}
                  y={toiletReferenceY(model.yMax) - 4}
                >
                  10 分钟
                </SvgText>
              </>
            ) : null}
            {model.paths.map((path, index) => (
              <Path
                d={path}
                fill="none"
                key={`path-${index}`}
                stroke={chartColor(colors, category)}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={range === 90 ? 2 : 3}
              />
            ))}
            {selectedPoint ? (
              <Line
                stroke={chartColor(colors, category)}
                strokeDasharray="3 4"
                strokeWidth="1"
                x1={selectedPoint.x}
                x2={selectedPoint.x}
                y1={trendChartFrame.plotTop}
                y2={trendChartFrame.plotBottom}
              />
            ) : null}
            {model.hasAnyRecord
              ? model.points.map((point, index) =>
                  point.rawY === null ? null : (
                    <Circle
                      cx={point.x}
                      cy={point.rawY}
                      fill={
                        index === selectedIndex ? chartPointColor(colors, category, point.attention) : colors.surface
                      }
                      key={index}
                      r={index === selectedIndex ? 5 : range === 90 ? 1.5 : range === 30 ? 2 : 2.5}
                      stroke={chartPointColor(colors, category, point.attention)}
                      strokeWidth={range === 90 && index !== selectedIndex ? 1.25 : 2}
                    />
                  ),
                )
              : null}
            {model.xLabels.map((label, index) => (
              <SvgText
                fill={colors.textSubtle}
                fontSize="9"
                key={`${label.date}-${label.index}`}
                textAnchor={index === 0 ? 'start' : index === model.xLabels.length - 1 ? 'end' : 'middle'}
                x={label.x}
                y={178}
              >
                {formatTrendShortDate(label.date)}
              </SvgText>
            ))}
          </Svg>
          {!model.hasAnyRecord ? (
            <Text pointerEvents="none" style={styles.chartEmpty}>
              {emptyTrendMessage(category)}
            </Text>
          ) : null}
        </Pressable>
      </View>
    </AppCard>
  );
}

function Segments<T extends string | number>({
  disabled = () => false,
  items,
  label,
  onSelect,
  selected,
}: {
  disabled?: (item: T) => boolean;
  items: T[];
  label: (item: T) => string;
  onSelect: (item: T) => void;
  selected: T;
}) {
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);
  return (
    <View style={styles.segments}>
      {items.map((item) => (
        <Pressable
          accessibilityRole="button"
          key={item}
          onPress={() => onSelect(item)}
          style={[
            styles.segment,
            item === selected ? styles.segmentActive : null,
            disabled(item) ? styles.segmentDisabled : null,
          ]}
        >
          <Text style={[styles.segmentText, item === selected ? styles.segmentTextActive : null]}>{label(item)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function DailyDataDetailModal({
  date,
  details,
  onClose,
}: {
  date: string | null;
  details: DailyDataDetails | null;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(detailSheetEnterTranslateY)).current;
  const isClosingRef = useRef(false);
  useEffect(() => setExpandedId(null), [date]);
  useEffect(() => {
    if (!date) {
      isClosingRef.current = false;
      return;
    }

    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(detailSheetEnterTranslateY);
    const openingAnimation = Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: 170,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslateY, {
        damping: 22,
        mass: 0.8,
        stiffness: 250,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]);
    const frame = requestAnimationFrame(() => openingAnimation.start());

    return () => {
      cancelAnimationFrame(frame);
      openingAnimation.stop();
    };
  }, [backdropOpacity, date, sheetTranslateY]);

  const close = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: 150,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        duration: 160,
        easing: Easing.in(Easing.cubic),
        toValue: detailSheetEnterTranslateY,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [backdropOpacity, onClose, sheetTranslateY]);

  if (!date) return null;
  return (
    <Modal animationType="none" onRequestClose={close} transparent visible>
      <View style={styles.modalRoot}>
        <Animated.View pointerEvents="none" style={[styles.modalOverlay, { opacity: backdropOpacity }]} />
        <Pressable accessibilityLabel="关闭日期详情" onPress={close} style={styles.modalBackdrop} />
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{formatFullDate(date)}</Text>
            <Pressable accessibilityLabel="关闭" onPress={close} style={styles.modalClose}>
              <X color={colors.textMuted} size={17} />
              <Text style={styles.modalCloseText}>关闭</Text>
            </Pressable>
          </View>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            style={styles.modalScroll}
          >
            {details ? (
              <>
                <View style={styles.detailSummary}>
                  <DetailSummaryMetric
                    color={colors.primary}
                    label="菊花抬"
                    value={`${details.summary.training.completedSessionCount} 次`}
                  />
                  <DetailSummaryMetric
                    color={colors.info}
                    label="小账本"
                    value={`${details.summary.habit.completionCount}/4 项`}
                  />
                  <DetailSummaryMetric
                    color={colors.warning}
                    label="蹲会儿"
                    value={`${details.summary.toilet.sessionCount} 次`}
                  />
                </View>
                <TrainingDetails details={details} />
                <HabitDetails summary={details.summary} />
                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>蹲会儿明细</Text>
                  {details.toiletSessions.length === 0 ? (
                    <Text style={styles.emptyText}>当天没有蹲会儿记录</Text>
                  ) : (
                    details.toiletSessions.map((session) => (
                      <ToiletDetailCard
                        expanded={expandedId === session.id}
                        key={session.id}
                        onToggle={() => setExpandedId(expandedId === session.id ? null : session.id)}
                        session={session}
                      />
                    ))
                  )}
                </View>
              </>
            ) : (
              <View style={styles.modalLoading}>
                <Text style={styles.emptyText}>正在读取当天记录…</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function DetailSummaryMetric({ color, label, value }: { color: string; label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);
  return (
    <View style={styles.detailSummaryMetric}>
      <View style={styles.detailSummaryLabelRow}>
        <View style={[styles.detailSummaryDot, { backgroundColor: color }]} />
        <Text numberOfLines={1} style={styles.detailSummaryLabel}>
          {label}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.detailSummaryValue}>
        {value}
      </Text>
    </View>
  );
}

function HabitDetails({ summary }: { summary: DailyActivitySummary }) {
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);
  const items = [
    ['饮水', summary.habit.water],
    ['膳食纤维', summary.habit.fiber],
    ['活动', summary.habit.movement],
    ['排便习惯', summary.habit.bowel],
  ] as const;
  return (
    <View style={styles.detailSection}>
      <Text style={styles.detailTitle}>小账本细节</Text>
      {items.map(([label, value]) => (
        <View key={label} style={styles.detailRow}>
          <Text style={styles.detailRowLabel}>{label}</Text>
          <Text style={styles.detailRowValue}>{habitLabel(value)}</Text>
        </View>
      ))}
    </View>
  );
}
function TrainingDetails({ details }: { details: DailyDataDetails }) {
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);
  return (
    <View style={styles.detailSection}>
      <Text style={styles.detailTitle}>训练记录</Text>
      {details.trainingSessions.length === 0 ? (
        <Text style={styles.emptyText}>当天没有训练记录</Text>
      ) : (
        details.trainingSessions.map((session) => (
          <View key={session.id} style={styles.trainingSessionCard}>
            <View style={styles.sessionHeader}>
              <Text numberOfLines={1} style={[styles.sessionTime, styles.trainingSessionTitle]}>
                {formatTime(session.endedAt)} · {getTrainingPreset(session.presetId).name}
              </Text>
              <View style={[styles.trainingStatus, session.isCompleted ? null : styles.trainingStatusIncomplete]}>
                <Text
                  style={[styles.trainingStatusText, session.isCompleted ? null : styles.trainingStatusTextIncomplete]}
                >
                  {session.isCompleted ? '已完成' : '未完成'}
                </Text>
              </View>
            </View>
            <Text style={styles.trainingSessionMeta}>
              {session.completedRepetitions} 次 · {formatDuration(session.durationSeconds)}
            </Text>
            {session.discomfortReported ? <Text style={styles.trainingDiscomfort}>训练时记录了不适</Text> : null}
          </View>
        ))
      )}
    </View>
  );
}
function ToiletDetailCard({
  expanded,
  onToggle,
  session,
}: {
  expanded: boolean;
  onToggle: () => void;
  session: ToiletSession;
}) {
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);
  const labels = [
    feelingLabel(session.feeling),
    getToiletStoolShapeLabel(session.stoolShape),
    getToiletStoolColorLabel(session.stoolColor),
    ...(session.signals ?? []).map((signal) => signal.label),
    ...(session.discomfort ? ['明显不舒服'] : []),
    ...(session.bleeding ? ['明显便血'] : []),
  ].filter(Boolean) as string[];
  const content = (
    <>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionTime}>{formatTime(session.endedAt)}</Text>
        <Text style={styles.sessionDuration}>{formatDuration(session.durationSeconds)}</Text>
      </View>
      <Text style={styles.sessionToggle}>
        {expanded ? '收起排便详情' : labels.length > 0 ? '展开排便详情' : '未填写排便详情'}
      </Text>
      {expanded && labels.length > 0 ? (
        <View style={styles.detailChips}>
          {labels.map((label, index) => (
            <View key={`${label}-${index}`} style={styles.detailChip}>
              <Text style={styles.detailChipText}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );

  if (labels.length === 0) return <View style={styles.sessionCard}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onToggle}
      style={styles.sessionCard}
    >
      {content}
    </Pressable>
  );
}

function chartColor(colors: ReturnType<typeof useAppTheme>['colors'], category: TrendCategory) {
  return category === 'training' ? colors.primary : category === 'habit' ? colors.info : colors.warning;
}
function chartPointColor(
  colors: ReturnType<typeof useAppTheme>['colors'],
  category: TrendCategory,
  attention: boolean,
) {
  return category === 'toilet' && attention ? colors.danger : chartColor(colors, category);
}
function toiletReferenceY(yMax: number) {
  const ratio = Math.min(1, 10 / Math.max(1, yMax));
  return trendChartFrame.plotBottom - ratio * (trendChartFrame.plotBottom - trendChartFrame.plotTop);
}
function emptyTrendMessage(category: TrendCategory) {
  return category === 'training'
    ? '这段时间还没有训练记录'
    : category === 'habit'
      ? '这段时间还没有小账本记录'
      : '这段时间还没有蹲会儿记录';
}
function formatHabitSummary(summary: DailyActivitySummary) {
  const count = summary.habit.completionCount;
  return count === 4 ? '记录完整' : count > 0 ? `已记录 ${count} 项` : '尚未记录';
}
function habitLabel(value: string | null) {
  return value === 'good' ? '达标' : value === 'medium' ? '一般' : value === 'low' ? '偏少' : '未记录';
}
function feelingLabel(value: ToiletSession['feeling']) {
  return { difficult: '困难', normal: '一般', smooth: '顺畅' }[value];
}
function formatMinutes(seconds: number) {
  return Math.round(seconds / 60);
}
function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes} 分 ${remaining} 秒` : `${minutes} 分钟`;
}
function formatTime(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function formatFullDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${Number(year)} 年 ${Number(month)} 月 ${Number(day)} 日`;
}

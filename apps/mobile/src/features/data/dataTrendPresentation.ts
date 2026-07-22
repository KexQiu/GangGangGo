import type { DailyActivitySummary } from '@xiaotidu/contracts';

export type TrendCategory = 'training' | 'habit' | 'toilet';
export type TrendRange = 7 | 30 | 90;

export const trendChartFrame = {
  height: 190,
  plotBottom: 148,
  plotLeft: 36,
  plotRight: 308,
  plotTop: 18,
  width: 320,
} as const;

export type TrendPoint = {
  attention: boolean;
  date: string;
  index: number;
  rawValue: number | null;
  rawY: number | null;
  x: number;
};

export type DataTrendModel = {
  days: DailyActivitySummary[];
  hasAnyRecord: boolean;
  paths: string[];
  points: TrendPoint[];
  xLabels: Array<{ date: string; index: number; x: number }>;
  yMax: number;
  yTicks: Array<{ value: number; y: number }>;
};

export function buildDataTrendModel(
  summaries: DailyActivitySummary[],
  range: TrendRange,
  category: TrendCategory,
): DataTrendModel {
  const days = summaries.slice(-range);
  const rawValues = days.map((summary) => getTrendValue(summary, category));
  const hasAnyRecord = rawValues.some((value) => value !== null);
  const yMax = getYAxisMax(rawValues, category);
  const points = days.map((summary, index) => {
    const rawValue = rawValues[index] ?? null;
    const x = valueToX(index, days.length);
    return {
      attention: category === 'toilet' && summary.toilet.attentionCount > 0,
      date: summary.date,
      index,
      rawValue,
      rawY: rawValue === null ? null : valueToY(rawValue, yMax),
      x,
    };
  });
  return {
    days,
    hasAnyRecord,
    paths: hasAnyRecord ? buildTrendPaths(points) : [],
    points,
    xLabels: getXAxisLabelIndexes(days.length, range).map((index) => ({
      date: days[index]?.date ?? '',
      index,
      x: valueToX(index, days.length),
    })),
    yMax,
    yTicks: [yMax, yMax / 2, 0].map((value) => ({ value, y: valueToY(value, yMax) })),
  };
}

export function getTrendSelectionIndex(locationX: number, containerWidth: number, pointCount: number) {
  if (pointCount <= 1 || containerWidth <= 0) return 0;
  const plotLeft = (trendChartFrame.plotLeft / trendChartFrame.width) * containerWidth;
  const plotRight = (trendChartFrame.plotRight / trendChartFrame.width) * containerWidth;
  const ratio = clamp((locationX - plotLeft) / (plotRight - plotLeft), 0, 1);
  return Math.round(ratio * (pointCount - 1));
}

export function shouldCaptureTrendGesture(dx: number, dy: number) {
  return Math.abs(dx) >= 6 && Math.abs(dx) > Math.abs(dy) * 1.2;
}

export function formatTrendValue(value: number | null, category: TrendCategory) {
  if (value === null) return '无记录';
  if (category === 'habit') return `${Math.round(value)}/4 项`;
  if (category === 'training') return `${Math.round(value)} 次`;
  return `${value.toFixed(value < 10 ? 1 : 0)} 分钟`;
}

export function trendMetricLabel(category: TrendCategory) {
  if (category === 'training') return '完成次数';
  if (category === 'habit') return '记录项数';
  return '最长时长';
}

export function formatTrendAxisValue(value: number, category: TrendCategory) {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return category === 'toilet' ? `${formatted}分` : formatted;
}

export function formatTrendShortDate(date: string) {
  const [, month, day] = date.split('-');
  return `${Number(month)}.${Number(day)}`;
}

function getTrendValue(summary: DailyActivitySummary, category: TrendCategory) {
  if (category === 'training') {
    const hasRecord =
      summary.training.completedSessionCount > 0 ||
      summary.training.completedRepetitions > 0 ||
      summary.training.totalDurationSeconds > 0;
    return hasRecord ? summary.training.completedSessionCount : null;
  }
  if (category === 'habit') {
    const hasRecord = [summary.habit.water, summary.habit.fiber, summary.habit.movement, summary.habit.bowel].some(
      (value) => value !== null,
    );
    return hasRecord ? summary.habit.completionCount : null;
  }
  if (summary.toilet.sessionCount === 0) return null;
  const longestDurationSeconds = summary.toilet.maxDurationSeconds || summary.toilet.medianDurationSeconds;
  return longestDurationSeconds / 60;
}

function getYAxisMax(values: Array<number | null>, category: TrendCategory) {
  if (category === 'habit') return 4;
  const observedMax = Math.max(0, ...values.map((value) => value ?? 0));
  const minimum = category === 'toilet' ? 15 : 2;
  if (observedMax <= minimum) return minimum;
  return niceCeiling(observedMax);
}

function niceCeiling(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const multiplier = [1, 2, 2.5, 4, 5, 10].find((candidate) => normalized <= candidate) ?? 10;
  return multiplier * magnitude;
}

function valueToX(index: number, pointCount: number) {
  if (pointCount <= 1) return trendChartFrame.plotLeft;
  return (
    trendChartFrame.plotLeft +
    (index * (trendChartFrame.plotRight - trendChartFrame.plotLeft)) / Math.max(1, pointCount - 1)
  );
}

function valueToY(value: number, yMax: number) {
  const ratio = clamp(value / Math.max(1, yMax), 0, 1);
  return trendChartFrame.plotBottom - ratio * (trendChartFrame.plotBottom - trendChartFrame.plotTop);
}

function buildTrendPaths(points: TrendPoint[]) {
  const paths: string[] = [];
  let path = '';
  for (const point of points) {
    if (point.rawY === null) {
      if (path) paths.push(path);
      path = '';
    } else {
      path += `${path ? ' L' : 'M'} ${point.x.toFixed(2)} ${point.rawY.toFixed(2)}`;
    }
  }
  if (path) paths.push(path);
  return paths;
}

function getXAxisLabelIndexes(pointCount: number, range: TrendRange) {
  if (pointCount <= 0) return [];
  const fractions = range === 7 ? [0, 0.5, 1] : range === 30 ? [0, 0.25, 0.5, 0.75, 1] : [0, 1 / 3, 2 / 3, 1];
  return [...new Set(fractions.map((fraction) => Math.round(fraction * (pointCount - 1))))];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

import type { DailyActivitySummary } from '@xiaotidu/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildDataTrendModel,
  getTrendSelectionIndex,
  shouldCaptureTrendGesture,
  trendChartFrame,
} from '../dataTrendPresentation';

describe('data trend presentation', () => {
  it('maps touches against the inset plot instead of the whole container', () => {
    const width = 375;
    const left = (trendChartFrame.plotLeft / trendChartFrame.width) * width;
    const right = (trendChartFrame.plotRight / trendChartFrame.width) * width;

    expect(getTrendSelectionIndex(left, width, 90)).toBe(0);
    expect(getTrendSelectionIndex(right, width, 90)).toBe(89);
    expect(getTrendSelectionIndex((left + right) / 2, width, 90)).toBe(45);
  });

  it('only captures deliberate horizontal movement', () => {
    expect(shouldCaptureTrendGesture(12, 3)).toBe(true);
    expect(shouldCaptureTrendGesture(3, 12)).toBe(false);
    expect(shouldCaptureTrendGesture(4, 1)).toBe(false);
  });

  it('treats an unfilled habit day as missing data instead of zero', () => {
    const empty = summary('2026-07-21');
    const recorded = summary('2026-07-22');
    recorded.habit.water = 'low';
    recorded.habit.completionCount = 1;

    const model = buildDataTrendModel([empty, recorded], 7, 'habit');

    expect(model.points.map((point) => point.rawValue)).toEqual([null, 1]);
    expect(model.paths).toHaveLength(1);
  });

  it('uses the longest toilet session and retains the attention state', () => {
    const day = summary('2026-07-22');
    day.toilet.attentionCount = 1;
    day.toilet.maxDurationSeconds = 1_260;
    day.toilet.medianDurationSeconds = 360;
    day.toilet.sessionCount = 3;

    const model = buildDataTrendModel([day], 7, 'toilet');

    expect(model.points[0]).toMatchObject({ attention: true, rawValue: 21 });
    expect(model.yMax).toBeGreaterThanOrEqual(21);
  });

  it('falls back to the stored median for summaries created before maximum duration was added', () => {
    const day = summary('2026-07-22');
    day.toilet.maxDurationSeconds = 0;
    day.toilet.medianDurationSeconds = 360;
    day.toilet.sessionCount = 2;

    const model = buildDataTrendModel([day], 30, 'toilet');

    expect(model.points[0]?.rawValue).toBe(6);
  });

  it('treats an unrecorded training day as a gap instead of a zero result', () => {
    const empty = summary('2026-07-21');
    const recorded = summary('2026-07-22');
    recorded.training.completedRepetitions = 20;
    recorded.training.completedSessionCount = 1;
    recorded.training.totalDurationSeconds = 60;

    const model = buildDataTrendModel([empty, recorded], 7, 'training');

    expect(model.points.map((point) => point.rawValue)).toEqual([null, 1]);
  });

  it('keeps all 30 and 90 daily positions and breaks the line on missing dates', () => {
    const days = Array.from({ length: 90 }, (_, index) => {
      const date = new Date(2026, 3, 24, 12);
      date.setDate(date.getDate() + index);
      const day = summary(toDateKey(date));
      if (index === 70 || index === 72 || index === 89) {
        day.toilet.maxDurationSeconds = (index - 68) * 60;
        day.toilet.sessionCount = 1;
      }
      return day;
    });

    const thirtyDayModel = buildDataTrendModel(days, 30, 'toilet');
    const ninetyDayModel = buildDataTrendModel(days, 90, 'toilet');

    expect(thirtyDayModel.points).toHaveLength(30);
    expect(thirtyDayModel.points.filter((point) => point.rawValue !== null)).toHaveLength(3);
    expect(ninetyDayModel.points).toHaveLength(90);
    expect(ninetyDayModel.points[71]).toMatchObject({ rawValue: null, rawY: null });
    expect(ninetyDayModel.paths).toHaveLength(3);
  });
});

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function summary(date: string): DailyActivitySummary {
  return {
    date,
    habit: { bowel: null, completionCount: 0, fiber: null, movement: null, water: null },
    toilet: {
      attentionCount: 0,
      colorCounts: {},
      feelingCounts: {},
      longSessionCount: 0,
      maxDurationSeconds: 0,
      medianDurationSeconds: 0,
      sessionCount: 0,
      shapeCounts: {},
      signalCounts: {},
      totalDurationSeconds: 0,
    },
    training: { completedRepetitions: 0, completedSessionCount: 0, totalDurationSeconds: 0 },
  };
}

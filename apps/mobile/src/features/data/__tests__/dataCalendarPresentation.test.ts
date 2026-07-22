import type { DailyActivitySummary } from '@xiaotidu/contracts';
import { describe, expect, it } from 'vitest';

import { themeColors } from '../../../theme/colors';
import { buildDataCalendarMarkedDates, getDataCalendarRange } from '../dataCalendarPresentation';

describe('data calendar presentation', () => {
  it('keeps three gray marker positions for a day without records', () => {
    const markedDates = buildDataCalendarMarkedDates([summary('2026-07-22')], themeColors.light);

    expect(markedDates['2026-07-22']?.dots).toEqual([
      { color: themeColors.light.border, key: 'training' },
      { color: themeColors.light.border, key: 'habit' },
      { color: themeColors.light.border, key: 'toilet' },
    ]);
  });

  it('maps each activity marker and gives toilet attention the danger color', () => {
    const active = summary('2026-07-22');
    active.training.completedSessionCount = 2;
    active.habit.completionCount = 3;
    active.toilet.sessionCount = 1;
    active.toilet.attentionCount = 1;

    const markedDates = buildDataCalendarMarkedDates([active], themeColors.dark);

    expect(markedDates['2026-07-22']?.dots).toEqual([
      { color: themeColors.dark.primary, key: 'training' },
      { color: themeColors.dark.info, key: 'habit' },
      { color: themeColors.dark.danger, key: 'toilet' },
    ]);
    expect(markedDates['2026-07-22']?.accessibilityLabel).toContain('训练 2 次，小账本 3 项，蹲会儿 1 次');
  });

  it('uses the warning color for a toilet record without an attention signal', () => {
    const active = summary('2026-07-22');
    active.toilet.sessionCount = 1;

    const markedDates = buildDataCalendarMarkedDates([active], themeColors.light);

    expect(markedDates['2026-07-22']?.dots?.[2]).toEqual({ color: themeColors.light.warning, key: 'toilet' });
  });

  it('keeps the actively browsed date highlighted', () => {
    const markedDates = buildDataCalendarMarkedDates(
      [summary('2026-07-21'), summary('2026-07-22')],
      themeColors.light,
      '2026-07-21',
    );

    expect(markedDates['2026-07-21']).toMatchObject({
      selected: true,
      selectedColor: themeColors.light.primarySoft,
      selectedTextColor: themeColors.light.text,
    });
    expect(markedDates['2026-07-22']?.selected).toBe(false);
  });

  it('derives the exact date limits and number of previous months', () => {
    expect(getDataCalendarRange([summary('2026-07-22'), summary('2026-04-24')], '2026-07-22')).toEqual({
      maxDate: '2026-07-22',
      maxMonth: '2026-07',
      minDate: '2026-04-24',
      minMonth: '2026-04',
      pastScrollRange: 3,
    });
  });
});

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

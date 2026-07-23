import type { FriendSharedDay } from '@xiaotidu/contracts';
import { describe, expect, it } from 'vitest';

import { themeColors } from '../../../theme/colors';
import { buildFriendCalendarMarkedDates, getFriendCalendarRange } from '../friendDataCalendarPresentation';

describe('friend data calendar presentation', () => {
  it('keeps hidden domains neutral without revealing their activity', () => {
    const day = sharedDay('2026-07-22');
    day.training = { level: 'none' };
    day.habit = { level: 'none' };
    day.toilet = { level: 'none' };

    const marked = buildFriendCalendarMarkedDates([day], themeColors.light, day.date);

    expect(marked[day.date]).toMatchObject({
      dots: [
        { color: themeColors.light.border, key: 'training' },
        { color: themeColors.light.border, key: 'habit' },
        { color: themeColors.light.border, key: 'toilet' },
      ],
      selected: true,
    });
    expect(marked[day.date]?.accessibilityLabel).toContain('菊花抬未授权');
    expect(marked[day.date]?.accessibilityLabel).not.toContain('2 次');
  });

  it('uses domain colors only for granted data and flags detailed toilet attention', () => {
    const day = sharedDay('2026-07-22');

    expect(buildFriendCalendarMarkedDates([day], themeColors.dark)[day.date]?.dots).toEqual([
      { color: themeColors.dark.primary, key: 'training' },
      { color: themeColors.dark.info, key: 'habit' },
      { color: themeColors.dark.danger, key: 'toilet' },
    ]);
  });

  it('limits the calendar to the server-authorized history window', () => {
    expect(getFriendCalendarRange([sharedDay('2026-06-24'), sharedDay('2026-07-22')])).toEqual({
      maxDate: '2026-07-22',
      maxMonth: '2026-07',
      minDate: '2026-06-24',
      minMonth: '2026-06',
      pastScrollRange: 1,
    });
  });
});

function sharedDay(date: string): FriendSharedDay {
  return {
    date,
    habit: {
      bowel: 'good',
      completionCount: 3,
      fiber: 'medium',
      level: 'detailed',
      movement: 'good',
      streakDays: 4,
      water: 'low',
    },
    toilet: {
      attentionCount: 1,
      colorCounts: {},
      feelingCounts: {},
      level: 'detailed',
      longSessionCount: 0,
      maxDurationSeconds: 600,
      medianDurationSeconds: 600,
      sessionCount: 1,
      shapeCounts: {},
      signalCounts: {},
      toiletRecorded: true,
      totalDurationSeconds: 600,
    },
    training: {
      completedRepetitions: 40,
      completedSessionCount: 2,
      level: 'detailed',
      totalDurationSeconds: 300,
      trainingDone: true,
    },
  };
}

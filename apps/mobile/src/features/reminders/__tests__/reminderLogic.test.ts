import { describe, expect, it } from 'vitest';

import {
  defaultReminderSettings,
  getQuietHoursLabel,
  isTimeInQuietHoursRanges,
  normalizeReminderSettings,
} from '../reminderLogic';

describe('quiet-hour ranges', () => {
  it('keeps an empty range list disabled after normalization', () => {
    const settings = normalizeReminderSettings({ ...defaultReminderSettings, quietHoursRanges: [] });

    expect(settings.quietHoursRanges).toEqual([]);
    expect(getQuietHoursLabel(settings)).toBe('关闭');
    expect(isTimeInQuietHoursRanges('23:00', settings)).toBe(false);
  });

  it('uses all valid ranges, including one crossing midnight', () => {
    const settings = normalizeReminderSettings({
      ...defaultReminderSettings,
      quietHoursRanges: [
        { id: 'night', start: '22:30', end: '08:30' },
        { id: 'lunch', start: '12:30', end: '14:00' },
        { id: 'invalid', start: '25:00', end: '26:00' },
        { id: 'empty', start: '09:00', end: '09:00' },
      ],
    });

    expect(settings.quietHoursRanges.map((range) => range.id)).toEqual(['lunch', 'night']);
    expect(isTimeInQuietHoursRanges('23:00', settings)).toBe(true);
    expect(isTimeInQuietHoursRanges('07:00', settings)).toBe(true);
    expect(isTimeInQuietHoursRanges('13:00', settings)).toBe(true);
    expect(isTimeInQuietHoursRanges('14:00', settings)).toBe(false);
    expect(isTimeInQuietHoursRanges('09:00', settings)).toBe(false);
  });
});

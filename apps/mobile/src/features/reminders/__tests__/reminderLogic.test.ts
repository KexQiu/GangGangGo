import { describe, expect, it } from 'vitest';

import {
  defaultReminderSettings,
  getQuietHoursLabel,
  getSedentaryReminderTimes,
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

describe('daily sedentary times', () => {
  it('excludes the quiet start and the end of the active window', () => {
    const settings = {
      ...defaultReminderSettings,
      sedentaryEnabled: true,
      quietHoursRanges: [{ id: 'lunch', start: '12:00', end: '14:00' }],
    };
    expect(getSedentaryReminderTimes(settings)).toEqual([
      '10:00',
      '11:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
      '19:00',
      '20:00',
    ]);
    expect(isTimeInQuietHoursRanges('12:00', settings)).toBe(true);
    expect(isTimeInQuietHoursRanges('14:00', settings)).toBe(false);
  });

  it.each([
    [{ id: 'night', start: '20:00', end: '10:00' }],
    [
      { id: 'one', start: '12:00', end: '14:00' },
      { id: 'two', start: '14:00', end: '16:00' },
    ],
    [
      { id: 'one', start: '12:00', end: '15:00' },
      { id: 'two', start: '14:00', end: '16:00' },
    ],
  ])('filters cross-midnight, adjacent and overlapping quiet ranges: %j', (...quietHoursRanges) => {
    const settings = { ...defaultReminderSettings, sedentaryEnabled: true, quietHoursRanges };
    const times = getSedentaryReminderTimes(settings);
    expect(times.length).toBeGreaterThan(0);
    expect(new Set(times).size).toBe(times.length);
    expect(times.every((time) => !isTimeInQuietHoursRanges(time, settings))).toBe(true);
  });

  it('schedules nothing when disabled or quiet hours cover the whole active window', () => {
    expect(getSedentaryReminderTimes(defaultReminderSettings)).toEqual([]);
    expect(
      getSedentaryReminderTimes({
        ...defaultReminderSettings,
        sedentaryEnabled: true,
        quietHoursRanges: [{ id: 'all', start: '08:00', end: '22:00' }],
      }),
    ).toEqual([]);
  });

  it('uses at most 15 daily slots even at the shortest supported interval', () => {
    expect(
      getSedentaryReminderTimes({
        ...defaultReminderSettings,
        sedentaryEnabled: true,
        sedentaryIntervalMinutes: 45,
        quietHoursRanges: [],
      }),
    ).toHaveLength(15);
  });
});

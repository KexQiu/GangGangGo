import { describe, expect, it } from 'vitest';

import {
  createToiletRecordDraft,
  isToiletStoolColor,
  MAX_TOILET_SIGNALS_PER_SESSION,
  normalizeToiletSignalLabel,
  normalizeToiletSignals,
  toiletStoolColorOptions,
} from '../toiletRecordLogic';
import { buildLocalToiletHistoryCalendarDays, mergeToiletHistoryIntoCalendarDays } from '../toiletHistoryPresentation';

describe('toilet record logic', () => {
  it('keeps legacy sessions editable with empty optional details', () => {
    const draft = createToiletRecordDraft({
      bleeding: false,
      discomfort: false,
      durationSeconds: 427,
      endedAt: '2026-07-20T08:07:00.000Z',
      feeling: 'normal',
      id: 'legacy-session',
      startedAt: '2026-07-20T08:00:00.000Z',
    });

    expect(draft).toMatchObject({ signals: [], stoolColor: null, stoolShape: null });
  });

  it('limits new color choices while safely reading the retired legacy value', () => {
    expect(toiletStoolColorOptions).toEqual([
      { label: '常见颜色', value: 'normal' },
      { label: '需要留意', value: 'attention' },
    ]);
    expect(isToiletStoolColor('other')).toBe(true);

    const draft = createToiletRecordDraft({
      bleeding: false,
      discomfort: false,
      durationSeconds: 180,
      endedAt: '2026-07-27T08:03:00.000Z',
      feeling: 'normal',
      id: 'legacy-other-color',
      signals: [],
      startedAt: '2026-07-27T08:00:00.000Z',
      stoolColor: 'other',
      stoolShape: null,
    });

    expect(draft.stoolColor).toBeNull();
  });

  it('normalizes custom labels and rejects malformed or duplicate signal snapshots', () => {
    expect(normalizeToiletSignalLabel('  饮食   变化  ')).toBe('饮食 变化');
    expect(
      normalizeToiletSignals([
        { id: 'pain', label: ' 腹痛 ' },
        { id: 'pain', label: '重复' },
        { id: '', label: '无效' },
        { id: 'blank', label: '   ' },
      ]),
    ).toEqual([{ id: 'pain', label: '腹痛' }]);
  });

  it('bounds each session to the supported signal count', () => {
    const signals = Array.from({ length: MAX_TOILET_SIGNALS_PER_SESSION + 2 }, (_, index) => ({
      id: `signal-${index}`,
      label: `信号${index}`,
    }));

    expect(normalizeToiletSignals(signals)).toHaveLength(MAX_TOILET_SIGNALS_PER_SESSION);
  });

  it('keeps local toilet records visible when the cloud calendar has not refreshed', () => {
    const session = {
      bleeding: false,
      discomfort: false,
      durationSeconds: 16 * 60,
      endedAt: '2026-07-20T08:16:00.000Z',
      feeling: 'normal' as const,
      id: 'recent-session',
      startedAt: '2026-07-20T08:00:00.000Z',
    };
    const localDays = buildLocalToiletHistoryCalendarDays([session], new Date('2026-07-20T12:00:00.000Z'));
    const cloudDays = localDays.map((day) => ({ ...day, toiletLongMeeting: false, toiletRecorded: false }));

    const targetDay = mergeToiletHistoryIntoCalendarDays(cloudDays, [session]).find((day) => day.date === '2026-07-20');

    expect(targetDay).toMatchObject({ toiletLongMeeting: true, toiletRecorded: true });
  });
});

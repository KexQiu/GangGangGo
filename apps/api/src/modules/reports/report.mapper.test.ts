import { describe, expect, it } from 'vitest';

import type { DailyReportSnapshot } from '@xiaotidu/contracts';

import { buildAdvancedReport, eachDateInRange } from './report.mapper.js';

describe('advanced report mapper', () => {
  it('computes independent 7, 30, and 90 day summaries', () => {
    const dates = eachDateInRange('2026-04-15', '2026-07-13');
    const snapshots: DailyReportSnapshot[] = [
      snapshot(dates[0]!, { habitCompletion: 4 }),
      snapshot(dates[60]!, { toiletRecorded: true }),
      snapshot(dates[82]!, { trainingDone: true }),
      snapshot(dates[89]!, { streakDays: 9, toiletLongMeeting: true }),
    ];
    const report = buildAdvancedReport({
      endedAt: '2026-07-13',
      range: '90d',
      snapshots,
      startedAt: '2026-04-15',
    });

    expect(report.summaries['7d']).toMatchObject({
      currentStreakDays: 9,
      habitFullDays: 0,
      recordDays: 1,
      toiletLongMeetingCount: 1,
      toiletRecordDays: 0,
      trainingDays: 0,
    });
    expect(report.summaries['30d']).toMatchObject({
      currentStreakDays: 9,
      habitFullDays: 0,
      recordDays: 3,
      toiletLongMeetingCount: 1,
      toiletRecordDays: 1,
      trainingDays: 1,
    });
    expect(report.summaries['90d']).toMatchObject({
      currentStreakDays: 9,
      habitFullDays: 1,
      recordDays: 4,
      toiletLongMeetingCount: 1,
      toiletRecordDays: 1,
      trainingDays: 1,
    });
  });
});

function snapshot(date: string, input: Partial<DailyReportSnapshot>): DailyReportSnapshot {
  return {
    date,
    habitCompletion: 0,
    streakDays: 0,
    toiletLongMeeting: false,
    toiletRecorded: false,
    trainingDone: false,
    ...input,
  };
}

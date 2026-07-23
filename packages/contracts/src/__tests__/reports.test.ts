import { describe, expect, it } from 'vitest';

import {
  advancedReportDaySchema,
  advancedReportRangeSchema,
  advancedReportResponseSchema,
  advancedReportSummariesSchema,
  advancedReportSummarySchema,
  dailyReportSnapshotResponseSchema,
  dailyReportSnapshotSchema,
  dailyReportSnapshotsBulkResponseSchema,
  habitCompletionSchema,
  upsertDailyReportSnapshotRequestSchema,
  upsertDailyReportSnapshotsBulkRequestSchema,
} from '../index.js';
import { DATE, advancedReportDay, advancedReportSummary, dailyReportSnapshot } from './fixtures.js';

describe('report contracts', () => {
  const advancedResponse = {
    days: [advancedReportDay],
    endedAt: DATE,
    range: '90d',
    snapshot: dailyReportSnapshot,
    startedAt: '2026-04-15',
    summaries: {
      '7d': advancedReportSummary,
      '30d': advancedReportSummary,
      '90d': advancedReportSummary,
    },
  };

  it.each([
    ['habitCompletionSchema', habitCompletionSchema, 4],
    ['dailyReportSnapshotSchema', dailyReportSnapshotSchema, dailyReportSnapshot],
    [
      'upsertDailyReportSnapshotRequestSchema',
      upsertDailyReportSnapshotRequestSchema,
      { snapshot: dailyReportSnapshot },
    ],
    [
      'upsertDailyReportSnapshotsBulkRequestSchema',
      upsertDailyReportSnapshotsBulkRequestSchema,
      { snapshots: [dailyReportSnapshot] },
    ],
    ['dailyReportSnapshotResponseSchema', dailyReportSnapshotResponseSchema, { snapshot: dailyReportSnapshot }],
    [
      'dailyReportSnapshotsBulkResponseSchema',
      dailyReportSnapshotsBulkResponseSchema,
      { snapshots: [dailyReportSnapshot] },
    ],
    ['advancedReportRangeSchema', advancedReportRangeSchema, '90d'],
    ['advancedReportDaySchema', advancedReportDaySchema, advancedReportDay],
    ['advancedReportSummarySchema', advancedReportSummarySchema, advancedReportSummary],
    [
      'advancedReportSummariesSchema',
      advancedReportSummariesSchema,
      { '7d': advancedReportSummary, '30d': advancedReportSummary, '90d': advancedReportSummary },
    ],
    ['advancedReportResponseSchema', advancedReportResponseSchema, advancedResponse],
  ])('%s accepts a legal value', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it('accepts report boundaries', () => {
    expect(habitCompletionSchema.safeParse(0).success).toBe(true);
    expect(habitCompletionSchema.safeParse(4).success).toBe(true);
    expect(upsertDailyReportSnapshotsBulkRequestSchema.safeParse({ snapshots: [dailyReportSnapshot] }).success).toBe(
      true,
    );
    expect(
      upsertDailyReportSnapshotsBulkRequestSchema.safeParse({ snapshots: Array(90).fill(dailyReportSnapshot) }).success,
    ).toBe(true);
  });

  it('rejects invalid ranges, dates, counters, and bulk sizes', () => {
    expect(habitCompletionSchema.safeParse(-1).success).toBe(false);
    expect(habitCompletionSchema.safeParse(5).success).toBe(false);
    expect(habitCompletionSchema.safeParse(1.5).success).toBe(false);
    expect(dailyReportSnapshotSchema.safeParse({ ...dailyReportSnapshot, date: '2026-02-30' }).success).toBe(false);
    expect(dailyReportSnapshotSchema.safeParse({ ...dailyReportSnapshot, bleeding: true }).success).toBe(false);
    expect(upsertDailyReportSnapshotsBulkRequestSchema.safeParse({ snapshots: [] }).success).toBe(false);
    expect(
      upsertDailyReportSnapshotsBulkRequestSchema.safeParse({ snapshots: Array(91).fill(dailyReportSnapshot) }).success,
    ).toBe(false);
    expect(advancedReportRangeSchema.safeParse('30d').success).toBe(false);
    expect(advancedReportSummarySchema.safeParse({ ...advancedReportSummary, recordDays: -1 }).success).toBe(false);
  });

  it('rejects unknown upsert request fields', () => {
    expect(
      upsertDailyReportSnapshotRequestSchema.safeParse({ dryRun: true, snapshot: dailyReportSnapshot }).success,
    ).toBe(false);
    expect(
      upsertDailyReportSnapshotsBulkRequestSchema.safeParse({ replace: true, snapshots: [dailyReportSnapshot] })
        .success,
    ).toBe(false);
  });
});

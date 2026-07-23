import { z } from 'zod';

import { isoDateSchema } from './common.js';

export const habitCompletionSchema = z.number().int().min(0).max(4);
export const dailyReportSnapshotSchema = z
  .object({
    date: isoDateSchema,
    habitCompletion: habitCompletionSchema,
    streakDays: z.number().int().min(0),
    toiletLongMeeting: z.boolean(),
    toiletRecorded: z.boolean(),
    trainingDone: z.boolean(),
  })
  .strict()
  .meta({ id: 'DailyReportSnapshot' });
export type DailyReportSnapshot = z.infer<typeof dailyReportSnapshotSchema>;
export const upsertDailyReportSnapshotRequestSchema = z
  .object({ snapshot: dailyReportSnapshotSchema })
  .strict()
  .meta({ id: 'UpsertDailyReportSnapshotRequest' });
export type UpsertDailyReportSnapshotRequest = z.infer<typeof upsertDailyReportSnapshotRequestSchema>;
export const upsertDailyReportSnapshotsBulkRequestSchema = z
  .object({
    snapshots: z.array(dailyReportSnapshotSchema).min(1).max(90),
  })
  .strict()
  .meta({ id: 'UpsertDailyReportSnapshotsBulkRequest' });
export type UpsertDailyReportSnapshotsBulkRequest = z.infer<typeof upsertDailyReportSnapshotsBulkRequestSchema>;
export const dailyReportSnapshotResponseSchema = z
  .object({ snapshot: dailyReportSnapshotSchema })
  .meta({ id: 'DailyReportSnapshotResponse' });
export type DailyReportSnapshotResponse = z.infer<typeof dailyReportSnapshotResponseSchema>;
export const dailyReportSnapshotsBulkResponseSchema = z
  .object({ snapshots: z.array(dailyReportSnapshotSchema) })
  .meta({ id: 'DailyReportSnapshotsBulkResponse' });
export type DailyReportSnapshotsBulkResponse = z.infer<typeof dailyReportSnapshotsBulkResponseSchema>;

export const advancedReportRangeSchema = z.literal('90d');
export type AdvancedReportRange = z.infer<typeof advancedReportRangeSchema>;
export const advancedReportDaySchema = z.object({
  date: isoDateSchema,
  habitCompletion: habitCompletionSchema,
  habitFull: z.boolean(),
  toiletLongMeeting: z.boolean(),
  toiletRecorded: z.boolean(),
  trainingDone: z.boolean(),
});
export type AdvancedReportDay = z.infer<typeof advancedReportDaySchema>;
export const advancedReportSummarySchema = z.object({
  currentStreakDays: z.number().int().min(0),
  habitFullDays: z.number().int().min(0),
  hasAnyRecord: z.boolean(),
  recordDays: z.number().int().min(0),
  toiletLongMeetingCount: z.number().int().min(0),
  toiletRecordDays: z.number().int().min(0),
  trainingDays: z.number().int().min(0),
});
export type AdvancedReportSummary = z.infer<typeof advancedReportSummarySchema>;
export const advancedReportSummariesSchema = z.object({
  '7d': advancedReportSummarySchema,
  '30d': advancedReportSummarySchema,
  '90d': advancedReportSummarySchema,
});
export type AdvancedReportSummaries = z.infer<typeof advancedReportSummariesSchema>;
export const advancedReportResponseSchema = z
  .object({
    days: z.array(advancedReportDaySchema),
    endedAt: isoDateSchema,
    range: advancedReportRangeSchema,
    snapshot: dailyReportSnapshotSchema.nullable(),
    startedAt: isoDateSchema,
    summaries: advancedReportSummariesSchema,
  })
  .meta({ id: 'AdvancedReportResponse' });
export type AdvancedReportResponse = z.infer<typeof advancedReportResponseSchema>;

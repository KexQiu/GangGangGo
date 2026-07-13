import { z } from 'zod';

import { isoDateSchema } from './common.js';
import { dailyShareSnapshotSchema, habitCompletionSchema, teamMemberSchema } from './teams.js';

export const dailyReportSnapshotSchema = dailyShareSnapshotSchema
  .extend({ toiletLongMeeting: z.boolean() })
  .meta({ id: 'DailyReportSnapshot' });
export type DailyReportSnapshot = z.infer<typeof dailyReportSnapshotSchema>;
export const upsertDailyReportSnapshotRequestSchema = z
  .object({ snapshot: dailyReportSnapshotSchema })
  .meta({ id: 'UpsertDailyReportSnapshotRequest' });
export type UpsertDailyReportSnapshotRequest = z.infer<typeof upsertDailyReportSnapshotRequestSchema>;
export const upsertDailyReportSnapshotsBulkRequestSchema = z
  .object({
    snapshots: z.array(dailyReportSnapshotSchema).min(1).max(90),
  })
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
export const advancedReportResponseSchema = z
  .object({
    days: z.array(advancedReportDaySchema),
    endedAt: isoDateSchema,
    range: advancedReportRangeSchema,
    snapshot: dailyReportSnapshotSchema.nullable(),
    startedAt: isoDateSchema,
    summary: advancedReportSummarySchema,
  })
  .meta({ id: 'AdvancedReportResponse' });
export type AdvancedReportResponse = z.infer<typeof advancedReportResponseSchema>;

export const teamWeeklyReportResponseSchema = z
  .object({
    endedAt: isoDateSchema,
    memberCount: z.number().int().min(0),
    startedAt: isoDateSchema,
    summaries: z.array(
      z.object({
        habitFullDays: z.number().int().min(0),
        member: teamMemberSchema.pick({ displayName: true, id: true, user: true }),
        toiletRecordedDays: z.number().int().min(0),
        trainingDays: z.number().int().min(0),
      }),
    ),
  })
  .meta({ id: 'TeamWeeklyReportResponse' });
export type TeamWeeklyReportResponse = z.infer<typeof teamWeeklyReportResponseSchema>;

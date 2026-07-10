import { z } from 'zod';

export const advancedReportRangeSchema = z.literal('90d').default('90d');

const zeroToFourSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const zeroToSevenSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);

const dailyReportSnapshotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  habitCompletion: zeroToFourSchema,
  habitFull: z.boolean(),
  ninetyDayHabitFullDays: z.number().int().min(0).max(90),
  ninetyDayToiletLongMeetingCount: z.number().int().min(0),
  ninetyDayTrainingDays: z.number().int().min(0).max(90),
  streakDays: z.number().int().min(0),
  thirtyDayHabitFullDays: z.number().int().min(0).max(30),
  thirtyDayToiletLongMeetingCount: z.number().int().min(0),
  thirtyDayTrainingDays: z.number().int().min(0).max(30),
  toiletLongMeeting: z.boolean(),
  toiletRecorded: z.boolean(),
  trainingDone: z.boolean(),
  weeklyHabitFullDays: zeroToSevenSchema,
  weeklyToiletLongMeetingCount: z.number().int().min(0),
  weeklyTrainingDays: zeroToSevenSchema,
});

export const upsertDailyReportSnapshotSchema = z.object({
  snapshot: dailyReportSnapshotSchema,
});

export const upsertDailyReportSnapshotsBulkSchema = z.object({
  snapshots: z.array(dailyReportSnapshotSchema).min(1).max(90),
});

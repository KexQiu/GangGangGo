import { z } from 'zod';

import { isoDateSchema, isoDateTimeSchema } from './common.js';

export const dataSyncEntityTypeSchema = z.enum([
  'training_session',
  'habit_checkin',
  'toilet_session',
  'toilet_signal_preset',
]);
export type DataSyncEntityType = z.infer<typeof dataSyncEntityTypeSchema>;

const trainingPresetIdSchema = z.enum(['beginner', 'standard', 'quick']);
const habitLevelSchema = z.enum(['low', 'medium', 'good']);
const toiletFeelingSchema = z.enum(['smooth', 'normal', 'difficult']);
const toiletStoolShapeSchema = z.enum(['hard', 'formed', 'loose']);
const toiletStoolColorSchema = z.enum(['normal', 'attention', 'other']);
const toiletSignalSchema = z.object({ id: z.string().min(1).max(100), label: z.string().min(1).max(12) }).strict();

export const trainingSessionSyncPayloadSchema = z
  .object({
    completedRepetitions: z.number().int().min(0),
    discomfortReported: z.boolean(),
    durationSeconds: z.number().int().min(0),
    endedAt: isoDateTimeSchema,
    isCompleted: z.boolean(),
    localDate: isoDateSchema,
    presetId: trainingPresetIdSchema,
    startedAt: isoDateTimeSchema,
  })
  .strict();
export type TrainingSessionSyncPayload = z.infer<typeof trainingSessionSyncPayloadSchema>;

export const habitCheckInSyncPayloadSchema = z
  .object({
    bowel: habitLevelSchema.nullable(),
    date: isoDateSchema,
    fiber: habitLevelSchema.nullable(),
    movement: habitLevelSchema.nullable(),
    water: habitLevelSchema.nullable(),
  })
  .strict();
export type HabitCheckInSyncPayload = z.infer<typeof habitCheckInSyncPayloadSchema>;

export const toiletSessionSyncPayloadSchema = z
  .object({
    bleeding: z.boolean(),
    discomfort: z.boolean(),
    durationSeconds: z.number().int().min(0),
    endedAt: isoDateTimeSchema,
    feeling: toiletFeelingSchema,
    localDate: isoDateSchema,
    signals: z.array(toiletSignalSchema).max(5),
    startedAt: isoDateTimeSchema,
    stoolColor: toiletStoolColorSchema.nullable(),
    stoolShape: toiletStoolShapeSchema.nullable(),
  })
  .strict();
export type ToiletSessionSyncPayload = z.infer<typeof toiletSessionSyncPayloadSchema>;

export const toiletSignalPresetSyncPayloadSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    label: z.string().min(1).max(12),
  })
  .strict();
export type ToiletSignalPresetSyncPayload = z.infer<typeof toiletSignalPresetSyncPayloadSchema>;

export const dataSyncPayloadSchema = z.union([
  trainingSessionSyncPayloadSchema,
  habitCheckInSyncPayloadSchema,
  toiletSessionSyncPayloadSchema,
  toiletSignalPresetSyncPayloadSchema,
]);
export type DataSyncPayload = z.infer<typeof dataSyncPayloadSchema>;

const mutationBaseSchema = z.object({
  changedAt: isoDateTimeSchema,
  entityId: z.string().min(1).max(120),
  entityType: dataSyncEntityTypeSchema,
  mutationId: z.string().min(1).max(120),
});

export const dataSyncMutationSchema = z
  .discriminatedUnion('operation', [
    mutationBaseSchema.extend({ operation: z.literal('delete'), payload: z.null() }).strict(),
    mutationBaseSchema.extend({ operation: z.literal('upsert'), payload: dataSyncPayloadSchema }).strict(),
  ])
  .superRefine((mutation, context) => {
    if (mutation.operation !== 'upsert') return;
    const payloadSchemas = {
      habit_checkin: habitCheckInSyncPayloadSchema,
      toilet_session: toiletSessionSyncPayloadSchema,
      toilet_signal_preset: toiletSignalPresetSyncPayloadSchema,
      training_session: trainingSessionSyncPayloadSchema,
    } as const;
    if (!payloadSchemas[mutation.entityType].safeParse(mutation.payload).success) {
      context.addIssue({ code: 'custom', message: 'Payload does not match entity type.', path: ['payload'] });
    }
  });
export type DataSyncMutation = z.infer<typeof dataSyncMutationSchema>;

export const dataSyncChangeSchema = z
  .object({
    entityId: z.string(),
    entityType: dataSyncEntityTypeSchema,
    operation: z.enum(['delete', 'upsert']),
    payload: dataSyncPayloadSchema.nullable(),
    serverUpdatedAt: isoDateTimeSchema,
    version: z.number().int().positive(),
  })
  .strict();
export type DataSyncChange = z.infer<typeof dataSyncChangeSchema>;

export const dataSyncPushRequestSchema = z
  .object({ mutations: z.array(dataSyncMutationSchema).min(1).max(100), timeZone: z.string().min(1).max(100) })
  .strict()
  .meta({ id: 'DataSyncPushRequest' });
export type DataSyncPushRequest = z.infer<typeof dataSyncPushRequestSchema>;

export const dataSyncPushResponseSchema = z
  .object({ acceptedMutationIds: z.array(z.string()), changes: z.array(dataSyncChangeSchema) })
  .strict()
  .meta({ id: 'DataSyncPushResponse' });
export type DataSyncPushResponse = z.infer<typeof dataSyncPushResponseSchema>;

export const dataSyncPullResponseSchema = z
  .object({
    changes: z.array(dataSyncChangeSchema),
    hasMore: z.boolean(),
    nextCursor: z.string(),
    resetRequired: z.boolean(),
  })
  .strict()
  .meta({ id: 'DataSyncPullResponse' });
export type DataSyncPullResponse = z.infer<typeof dataSyncPullResponseSchema>;

const countMapSchema = z.record(z.string(), z.number().int().min(0));

export const dailyActivitySummarySchema = z
  .object({
    date: isoDateSchema,
    habit: z
      .object({
        bowel: habitLevelSchema.nullable(),
        completionCount: z.number().int().min(0).max(4),
        fiber: habitLevelSchema.nullable(),
        movement: habitLevelSchema.nullable(),
        water: habitLevelSchema.nullable(),
      })
      .strict(),
    toilet: z
      .object({
        attentionCount: z.number().int().min(0),
        colorCounts: countMapSchema,
        feelingCounts: countMapSchema,
        longSessionCount: z.number().int().min(0),
        maxDurationSeconds: z.number().int().min(0).default(0),
        medianDurationSeconds: z.number().int().min(0),
        sessionCount: z.number().int().min(0),
        shapeCounts: countMapSchema,
        signalCounts: countMapSchema,
        totalDurationSeconds: z.number().int().min(0),
      })
      .strict(),
    training: z
      .object({
        completedRepetitions: z.number().int().min(0),
        completedSessionCount: z.number().int().min(0),
        totalDurationSeconds: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();
export type DailyActivitySummary = z.infer<typeof dailyActivitySummarySchema>;

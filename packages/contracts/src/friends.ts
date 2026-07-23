import { z } from 'zod';

import { isoDateSchema, isoDateTimeSchema, quietRangeSchema } from './common.js';
import { userSummarySchema } from './users.js';

export const FRIEND_DATA_LEVELS = ['none', 'summary', 'detailed'] as const;
export const FRIEND_HISTORY_DAYS = [1, 7, 30] as const;
export const FRIEND_NUDGE_TYPES = ['gentle', 'move', 'not_blank', 'habit_left', 'posture'] as const;
export const FRIEND_NUDGE_ACK_STATUSES = ['received', 'later', 'done'] as const;
export const FRIEND_NUDGE_DAILY_LIMITS = [0, 3, 5, 8] as const;

export const friendDataLevelSchema = z.enum(FRIEND_DATA_LEVELS);
export const friendHistoryDaysSchema = z.union(FRIEND_HISTORY_DAYS.map((value) => z.literal(value)));
export const friendNudgeTypeSchema = z.enum(FRIEND_NUDGE_TYPES);
export const friendNudgeAckStatusSchema = z.enum(FRIEND_NUDGE_ACK_STATUSES);
export const friendNudgeDailyLimitSchema = z.union(FRIEND_NUDGE_DAILY_LIMITS.map((value) => z.literal(value)));
export type FriendDataLevel = z.infer<typeof friendDataLevelSchema>;
export type FriendHistoryDays = z.infer<typeof friendHistoryDaysSchema>;
export type FriendNudgeType = z.infer<typeof friendNudgeTypeSchema>;
export type FriendNudgeAckStatus = z.infer<typeof friendNudgeAckStatusSchema>;
export type FriendNudgeDailyLimit = z.infer<typeof friendNudgeDailyLimitSchema>;

export const friendSettingsSchema = z
  .object({
    allowToiletEndNotificationsFromFriend: z.boolean(),
    habitLevel: friendDataLevelSchema,
    historyDays: friendHistoryDaysSchema,
    notifyFriendOnToiletEnd: z.boolean(),
    nudgeDailyLimit: friendNudgeDailyLimitSchema,
    nudgesEnabled: z.boolean(),
    quietRanges: z.array(quietRangeSchema).max(4),
    toiletLevel: friendDataLevelSchema,
    trainingLevel: friendDataLevelSchema,
  })
  .strict()
  .meta({ id: 'FriendSettings' });
export type FriendSettings = z.infer<typeof friendSettingsSchema>;

export const updateFriendSettingsRequestSchema = friendSettingsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, '至少需要更新一项好友设置。')
  .meta({ id: 'UpdateFriendSettingsRequest' });
export type UpdateFriendSettingsRequest = z.infer<typeof updateFriendSettingsRequestSchema>;

export const friendNudgeAckSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    revisionCount: z.union([z.literal(0), z.literal(1)]),
    status: friendNudgeAckStatusSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .meta({ id: 'FriendNudgeAck' });
export type FriendNudgeAck = z.infer<typeof friendNudgeAckSchema>;

const friendEventBaseSchema = z.object({
  createdAt: isoDateTimeSchema,
  friendshipId: z.string().uuid(),
  fromUser: userSummarySchema,
  id: z.string().uuid(),
  occurredAt: isoDateTimeSchema,
  toUser: userSummarySchema,
});

export const manualFriendNudgeEventSchema = friendEventBaseSchema
  .extend({
    ack: friendNudgeAckSchema.nullable(),
    expiresAt: isoDateTimeSchema,
    kind: z.literal('manual_nudge'),
    message: z.string(),
    nudgeType: friendNudgeTypeSchema,
  })
  .strict()
  .meta({ id: 'ManualFriendNudgeEvent' });

export const toiletFinishedFriendEventSchema = friendEventBaseSchema
  .extend({
    durationSeconds: z.number().int().min(0).nullable(),
    kind: z.literal('toilet_finished'),
  })
  .strict()
  .meta({ id: 'ToiletFinishedFriendEvent' });

export const friendEventSchema = z
  .discriminatedUnion('kind', [manualFriendNudgeEventSchema, toiletFinishedFriendEventSchema])
  .meta({ id: 'FriendEvent' });
export type FriendEvent = z.infer<typeof friendEventSchema>;

export const friendDataPreviewSchema = z
  .object({
    date: isoDateSchema,
    habitCompletion: z.number().int().min(0).max(4).nullable(),
    streakDays: z.number().int().min(0).nullable(),
    toiletRecorded: z.boolean().nullable(),
    trainingDone: z.boolean().nullable(),
  })
  .strict()
  .meta({ id: 'FriendDataPreview' });
export type FriendDataPreview = z.infer<typeof friendDataPreviewSchema>;

export const friendSummarySchema = z
  .object({
    createdAt: isoDateTimeSchema,
    dataPreview: friendDataPreviewSchema,
    friend: userSummarySchema,
    friendshipId: z.string().uuid(),
    latestEvent: friendEventSchema.nullable(),
    pendingCount: z.number().int().min(0),
  })
  .strict()
  .meta({ id: 'FriendSummary' });
export type FriendSummary = z.infer<typeof friendSummarySchema>;

export const friendDetailSchema = friendSummarySchema
  .extend({
    friendSettings: friendSettingsSchema,
    mySettings: friendSettingsSchema,
    toiletNotificationsActive: z.boolean(),
  })
  .strict()
  .meta({ id: 'FriendDetail' });
export type FriendDetail = z.infer<typeof friendDetailSchema>;

export const friendsResponseSchema = z
  .object({ friends: z.array(friendSummarySchema).max(20) })
  .strict()
  .meta({ id: 'FriendsResponse' });
export type FriendsResponse = z.infer<typeof friendsResponseSchema>;
export const friendResponseSchema = z.object({ friend: friendDetailSchema }).strict().meta({ id: 'FriendResponse' });
export type FriendResponse = z.infer<typeof friendResponseSchema>;

export const createFriendInviteResponseSchema = z
  .object({
    expiresAt: isoDateTimeSchema,
    inviteId: z.string().uuid(),
    inviteUrl: z.string().url(),
    token: z.string(),
  })
  .strict()
  .meta({ id: 'CreateFriendInviteResponse' });
export type CreateFriendInviteResponse = z.infer<typeof createFriendInviteResponseSchema>;

export const friendInvitePreviewResponseSchema = z
  .object({ expiresAt: isoDateTimeSchema, inviter: userSummarySchema })
  .strict()
  .meta({ id: 'FriendInvitePreviewResponse' });
export type FriendInvitePreviewResponse = z.infer<typeof friendInvitePreviewResponseSchema>;

const hiddenTrainingSchema = z.object({ level: z.literal('none') }).strict();
const summaryTrainingSchema = z.object({ level: z.literal('summary'), trainingDone: z.boolean() }).strict();
const detailedTrainingSchema = z
  .object({
    completedRepetitions: z.number().int().min(0),
    completedSessionCount: z.number().int().min(0),
    level: z.literal('detailed'),
    totalDurationSeconds: z.number().int().min(0),
    trainingDone: z.boolean(),
  })
  .strict();
export const friendTrainingDataSchema = z.discriminatedUnion('level', [
  hiddenTrainingSchema,
  summaryTrainingSchema,
  detailedTrainingSchema,
]);

const hiddenHabitSchema = z.object({ level: z.literal('none') }).strict();
const summaryHabitSchema = z
  .object({
    completionCount: z.number().int().min(0).max(4),
    level: z.literal('summary'),
    streakDays: z.number().int().min(0),
  })
  .strict();
const habitLevelSchema = z.enum(['low', 'medium', 'good']).nullable();
const detailedHabitSchema = z
  .object({
    bowel: habitLevelSchema,
    completionCount: z.number().int().min(0).max(4),
    fiber: habitLevelSchema,
    level: z.literal('detailed'),
    movement: habitLevelSchema,
    streakDays: z.number().int().min(0),
    water: habitLevelSchema,
  })
  .strict();
export const friendHabitDataSchema = z.discriminatedUnion('level', [
  hiddenHabitSchema,
  summaryHabitSchema,
  detailedHabitSchema,
]);

const countMapSchema = z.record(z.string(), z.number().int().min(0));
const hiddenToiletSchema = z.object({ level: z.literal('none') }).strict();
const summaryToiletSchema = z.object({ level: z.literal('summary'), toiletRecorded: z.boolean() }).strict();
const detailedToiletSchema = z
  .object({
    attentionCount: z.number().int().min(0),
    colorCounts: countMapSchema,
    feelingCounts: countMapSchema,
    level: z.literal('detailed'),
    longSessionCount: z.number().int().min(0),
    maxDurationSeconds: z.number().int().min(0),
    medianDurationSeconds: z.number().int().min(0),
    sessionCount: z.number().int().min(0),
    shapeCounts: countMapSchema,
    signalCounts: countMapSchema,
    toiletRecorded: z.boolean(),
    totalDurationSeconds: z.number().int().min(0),
  })
  .strict();
export const friendToiletDataSchema = z.discriminatedUnion('level', [
  hiddenToiletSchema,
  summaryToiletSchema,
  detailedToiletSchema,
]);

export const friendSharedDaySchema = z
  .object({
    date: isoDateSchema,
    habit: friendHabitDataSchema,
    toilet: friendToiletDataSchema,
    training: friendTrainingDataSchema,
  })
  .strict()
  .meta({ id: 'FriendSharedDay' });
export type FriendSharedDay = z.infer<typeof friendSharedDaySchema>;

export const friendDataResponseSchema = z
  .object({
    days: z.array(friendSharedDaySchema).max(30),
    friend: userSummarySchema,
    historyDays: friendHistoryDaysSchema,
  })
  .strict()
  .meta({ id: 'FriendDataResponse' });
export type FriendDataResponse = z.infer<typeof friendDataResponseSchema>;

export const friendEventsResponseSchema = z
  .object({
    events: z.array(friendEventSchema),
    hasMore: z.boolean(),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict()
  .meta({ id: 'FriendEventsResponse' });
export type FriendEventsResponse = z.infer<typeof friendEventsResponseSchema>;

export const createFriendNudgeRequestSchema = z
  .object({ type: friendNudgeTypeSchema })
  .strict()
  .meta({ id: 'CreateFriendNudgeRequest' });
export type CreateFriendNudgeRequest = z.infer<typeof createFriendNudgeRequestSchema>;

export const ackFriendNudgeRequestSchema = z
  .object({ status: friendNudgeAckStatusSchema })
  .strict()
  .meta({ id: 'AckFriendNudgeRequest' });
export type AckFriendNudgeRequest = z.infer<typeof ackFriendNudgeRequestSchema>;

export const friendNudgeAckResponseSchema = z
  .object({ ack: friendNudgeAckSchema })
  .strict()
  .meta({ id: 'FriendNudgeAckResponse' });
export type FriendNudgeAckResponse = z.infer<typeof friendNudgeAckResponseSchema>;

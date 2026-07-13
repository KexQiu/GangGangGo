import { z } from 'zod';

import { isoDateTimeSchema } from './common.js';
import { teamMemberStatusSchema } from './teams.js';
import { userSummarySchema } from './users.js';

export const BUDDY_NUDGE_TYPES = ['gentle', 'move', 'not_blank', 'habit_left', 'posture'] as const;
export const BUDDY_NUDGE_ACK_STATUSES = ['received', 'later', 'done'] as const;
export const BUDDY_NUDGE_DAILY_LIMITS = [0, 3, 5, 8] as const;
export const buddyNudgeTypeSchema = z.enum(BUDDY_NUDGE_TYPES);
export const buddyNudgeAckStatusSchema = z.enum(BUDDY_NUDGE_ACK_STATUSES);
export const buddyNudgeDailyLimitSchema = z.union(BUDDY_NUDGE_DAILY_LIMITS.map((value) => z.literal(value)));
export type BuddyNudgeType = z.infer<typeof buddyNudgeTypeSchema>;
export type BuddyNudgeAckStatus = z.infer<typeof buddyNudgeAckStatusSchema>;
export type BuddyNudgeDailyLimit = z.infer<typeof buddyNudgeDailyLimitSchema>;

export const buddyNudgeAckSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    revisionCount: z.union([z.literal(0), z.literal(1)]),
    status: buddyNudgeAckStatusSchema,
    updatedAt: isoDateTimeSchema,
  })
  .meta({ id: 'BuddyNudgeAck' });
export type BuddyNudgeAck = z.infer<typeof buddyNudgeAckSchema>;
export const buddyNudgeSchema = z
  .object({
    ack: buddyNudgeAckSchema.nullable(),
    createdAt: isoDateTimeSchema,
    expiresAt: isoDateTimeSchema,
    fromUser: userSummarySchema,
    id: z.string().uuid(),
    messageTemplate: z.string(),
    teamId: z.string().uuid(),
    toUser: userSummarySchema,
    type: buddyNudgeTypeSchema,
  })
  .meta({ id: 'BuddyNudge' });
export type BuddyNudge = z.infer<typeof buddyNudgeSchema>;

export const createBuddyNudgeRequestSchema = z
  .object({ toUserId: z.string().uuid(), type: buddyNudgeTypeSchema })
  .meta({ id: 'CreateBuddyNudgeRequest' });
export type CreateBuddyNudgeRequest = z.infer<typeof createBuddyNudgeRequestSchema>;
export const ackBuddyNudgeRequestSchema = z
  .object({ status: buddyNudgeAckStatusSchema })
  .meta({ id: 'AckBuddyNudgeRequest' });
export type AckBuddyNudgeRequest = z.infer<typeof ackBuddyNudgeRequestSchema>;
export const buddyNudgeAckResponseSchema = z.object({ ack: buddyNudgeAckSchema }).meta({ id: 'BuddyNudgeAckResponse' });
export type BuddyNudgeAckResponse = z.infer<typeof buddyNudgeAckResponseSchema>;
export const buddyNudgesResponseSchema = z
  .object({ nudges: z.array(buddyNudgeSchema) })
  .meta({ id: 'BuddyNudgesResponse' });
export type BuddyNudgesResponse = z.infer<typeof buddyNudgesResponseSchema>;
export const buddyNudgeThreadResponseSchema = z
  .object({
    hasMore: z.boolean(),
    nextCursor: isoDateTimeSchema.nullable(),
    nudges: z.array(buddyNudgeSchema),
  })
  .meta({ id: 'BuddyNudgeThreadResponse' });
export type BuddyNudgeThreadResponse = z.infer<typeof buddyNudgeThreadResponseSchema>;

export const nudgeThreadSummarySchema = z.object({
  buddy: userSummarySchema,
  latestAt: isoDateTimeSchema.nullable(),
  latestPreview: z.string(),
  messageCount: z.number().int().min(0),
  pendingCount: z.number().int().min(0),
  status: teamMemberStatusSchema.nullable(),
});
export type NudgeThreadSummary = z.infer<typeof nudgeThreadSummarySchema>;
export const nudgeThreadsResponseSchema = z
  .object({ threads: z.array(nudgeThreadSummarySchema) })
  .meta({ id: 'NudgeThreadsResponse' });
export type NudgeThreadsResponse = z.infer<typeof nudgeThreadsResponseSchema>;

export const buddyNudgeSettingsSchema = z
  .object({
    buddyUserId: z.string().uuid(),
    dailyLimit: buddyNudgeDailyLimitSchema,
    enabled: z.boolean(),
    quietRanges: z
      .array(
        z.object({
          end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        }),
      )
      .max(4),
    teamId: z.string().uuid(),
    userId: z.string().uuid(),
  })
  .meta({ id: 'BuddyNudgeSettings' });
export type BuddyNudgeSettings = z.infer<typeof buddyNudgeSettingsSchema>;
export const buddyNudgeSettingsResponseSchema = z
  .object({ settings: z.array(buddyNudgeSettingsSchema) })
  .meta({ id: 'BuddyNudgeSettingsResponse' });
export type BuddyNudgeSettingsResponse = z.infer<typeof buddyNudgeSettingsResponseSchema>;
export const updateBuddyNudgeSettingsRequestSchema = buddyNudgeSettingsSchema
  .pick({
    dailyLimit: true,
    enabled: true,
    quietRanges: true,
  })
  .strict()
  .meta({ id: 'UpdateBuddyNudgeSettingsRequest' });
export type UpdateBuddyNudgeSettingsRequest = z.infer<typeof updateBuddyNudgeSettingsRequestSchema>;

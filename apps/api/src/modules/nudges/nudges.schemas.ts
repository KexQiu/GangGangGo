import { z } from 'zod';

const nudgeTypeSchema = z.union([
  z.literal('gentle'),
  z.literal('move'),
  z.literal('not_blank'),
  z.literal('habit_left'),
  z.literal('posture'),
]);

const nudgeAckStatusSchema = z.union([z.literal('received'), z.literal('later'), z.literal('done')]);
const nudgeDailyLimitSchema = z.union([z.literal(0), z.literal(3), z.literal(5), z.literal(8)]);
const quietTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const nudgeUserIdSchema = z.uuid();
export const nudgeIdSchema = z.string().min(1).max(80);

export const createBuddyNudgeRequestSchema = z.object({
  toUserId: nudgeUserIdSchema,
  type: nudgeTypeSchema,
});

export const ackBuddyNudgeRequestSchema = z.object({
  status: nudgeAckStatusSchema,
});

export const updateBuddyNudgeSettingsRequestSchema = z.object({
  dailyLimit: nudgeDailyLimitSchema,
  enabled: z.boolean(),
  quietRanges: z
    .array(
      z.object({
        end: quietTimeSchema,
        start: quietTimeSchema,
      }),
    )
    .max(4),
});

export const listNudgeThreadQuerySchema = z.object({
  before: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'before must be a valid datetime.')
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

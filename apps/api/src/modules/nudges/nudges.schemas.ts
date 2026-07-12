import { z } from 'zod';

export {
  ackBuddyNudgeRequestSchema,
  createBuddyNudgeRequestSchema,
  updateBuddyNudgeSettingsRequestSchema,
} from '@xiaotidu/contracts';

export const nudgeUserIdSchema = z.uuid();
export const nudgeIdSchema = z.string().min(1).max(80);

export const listNudgeThreadQuerySchema = z.object({
  before: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'before must be a valid datetime.')
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

import { z } from 'zod';

import {
  avatarBackgroundPresetKeys,
  avatarEmojiPresetKeys,
} from '@xiaotidu/contracts';

export const updateUserProfileRequestSchema = z
  .object({
    avatarUrl: z
      .object({
        background: z.enum(avatarBackgroundPresetKeys),
        emoji: z.enum(avatarEmojiPresetKeys).nullable(),
      })
      .strict()
      .nullable()
      .optional(),
    nickname: z.string().trim().min(1).max(20).nullable().optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

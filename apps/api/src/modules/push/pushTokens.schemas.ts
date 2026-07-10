import { z } from 'zod';

export const registerPushTokenRequestSchema = z.object({
  deviceId: z.string().min(1).max(120).optional(),
  platform: z.union([z.literal('ios'), z.literal('android')]),
  provider: z.union([z.literal('expo'), z.literal('apns')]),
  token: z.string().min(1).max(300),
});

import { z } from 'zod';

export const registerPushTokenRequestSchema = z
  .object({
    deviceId: z.string().min(1).max(120).optional(),
    platform: z.enum(['android', 'ios']),
    provider: z.enum(['apns', 'expo']),
    token: z.string().min(1).max(300),
  })
  .strict()
  .meta({ id: 'RegisterPushTokenRequest' });
export type RegisterPushTokenRequest = z.infer<typeof registerPushTokenRequestSchema>;
export type PushPlatform = RegisterPushTokenRequest['platform'];
export type PushProvider = RegisterPushTokenRequest['provider'];
export const registerPushTokenResponseSchema = z
  .object({ id: z.string().uuid() })
  .meta({ id: 'RegisterPushTokenResponse' });
export type RegisterPushTokenResponse = z.infer<typeof registerPushTokenResponseSchema>;

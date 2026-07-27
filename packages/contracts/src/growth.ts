import { z } from 'zod';

import { isoDateTimeSchema } from './common.js';

export const growthEventNameSchema = z.enum([
  'app_opened',
  'activation_completed',
  'login_completed',
  'friend_invite_sent',
  'friend_invite_accepted',
  'advanced_report_viewed',
  'watch_opened',
  'watch_action_completed',
  'sync_failed',
  'feature_interest_submitted',
]);
export type GrowthEventName = z.infer<typeof growthEventNameSchema>;

export const growthEventPropertiesSchema = z
  .object({
    action: z.enum(['training', 'habit', 'toilet']).optional(),
    domain: z.enum(['full_data', 'report', 'watch']).optional(),
    feature: z.enum(['advanced_report', 'watch', 'long_history', 'insights']).optional(),
    source: z.enum(['app_open', 'trends', 'watch', 'friend', 'settings']).optional(),
  })
  .strict();
export type GrowthEventProperties = z.infer<typeof growthEventPropertiesSchema>;

export const growthEventSchema = z
  .object({
    appVersion: z.string().min(1).max(32),
    eventId: z.string().min(1).max(80),
    installationId: z.string().regex(/^[a-zA-Z0-9_-]{16,80}$/),
    name: growthEventNameSchema,
    occurredAt: isoDateTimeSchema,
    platform: z.enum(['ios', 'android']),
    properties: growthEventPropertiesSchema.default({}),
  })
  .strict();
export type GrowthEvent = z.infer<typeof growthEventSchema>;

export const growthEventsRequestSchema = z
  .object({ events: z.array(growthEventSchema).min(1).max(50) })
  .strict()
  .meta({ id: 'GrowthEventsRequest' });
export type GrowthEventsRequest = z.infer<typeof growthEventsRequestSchema>;

export const growthEventsResponseSchema = z
  .object({ accepted: z.number().int().nonnegative() })
  .strict()
  .meta({ id: 'GrowthEventsResponse' });
export type GrowthEventsResponse = z.infer<typeof growthEventsResponseSchema>;

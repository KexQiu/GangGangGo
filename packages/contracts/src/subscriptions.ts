import { z } from 'zod';

import { entitlementsResponseSchema } from './common.js';

export const subscriptionStatusSchema = z.enum(['active', 'grace_period', 'expired', 'revoked']);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export const subscriptionEnvironmentSchema = z.enum(['sandbox', 'production']);
export type SubscriptionEnvironment = z.infer<typeof subscriptionEnvironmentSchema>;
export const autoRenewStatusSchema = z.enum(['on', 'off', 'unknown']);
export type AutoRenewStatus = z.infer<typeof autoRenewStatusSchema>;
export const subscriptionProductIdSchema = z.enum(['xiaotidu.pro.monthly', 'xiaotidu.pro.yearly']);
export type SubscriptionProductId = z.infer<typeof subscriptionProductIdSchema>;
export const verifySubscriptionRequestSchema = z
  .object({
    productId: subscriptionProductIdSchema,
    transactionId: z.string().min(1).max(200),
  })
  .strict();
export type VerifySubscriptionRequest = z.infer<typeof verifySubscriptionRequestSchema>;
export const restoreSubscriptionRequestSchema = z
  .object({ transactionIds: z.array(z.string().min(1).max(200)).min(1).max(20) })
  .strict();
export type RestoreSubscriptionRequest = z.infer<typeof restoreSubscriptionRequestSchema>;
export const subscriptionActionResponseSchema = z.object({
  entitlements: entitlementsResponseSchema,
  status: z.literal('pending_verification'),
});
export type SubscriptionActionResponse = z.infer<typeof subscriptionActionResponseSchema>;

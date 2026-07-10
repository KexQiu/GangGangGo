import { z } from 'zod';

const productIdSchema = z.union([
  z.literal('xiaotidu.pro.monthly'),
  z.literal('xiaotidu.pro.yearly'),
]);

export const verifySubscriptionRequestSchema = z.object({
  productId: productIdSchema,
  transactionId: z.string().min(1).max(200),
});

export const restoreSubscriptionRequestSchema = z.object({
  transactionIds: z.array(z.string().min(1).max(200)).min(1).max(20),
});

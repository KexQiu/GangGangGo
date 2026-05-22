import { Hono } from 'hono';
import { z } from 'zod';

import type {
  RestoreSubscriptionRequest,
  SubscriptionActionResponse,
  VerifySubscriptionRequest,
} from '@xiaotidu/contracts';

import type { AuthVariables } from '../http/middleware/auth.js';
import { toSuccessResponse } from '../http/responses.js';
import type { EntitlementsService } from '../modules/entitlements/entitlementsService.js';

const productIdSchema = z.union([
  z.literal('xiaotidu.pro.monthly'),
  z.literal('xiaotidu.pro.yearly'),
]);

const verifySubscriptionRequestSchema = z.object({
  productId: productIdSchema,
  transactionId: z.string().min(1).max(200),
});

const restoreSubscriptionRequestSchema = z.object({
  transactionIds: z.array(z.string().min(1).max(200)).min(1).max(20),
});

type CreateSubscriptionsRouteOptions = {
  entitlementsService: EntitlementsService;
};

export function createSubscriptionsRoute(options: CreateSubscriptionsRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();

  route.post('/verify', async (context) => {
    verifySubscriptionRequestSchema.parse(await context.req.json()) satisfies VerifySubscriptionRequest;
    const entitlements = await options.entitlementsService.getEntitlements(context.get('currentUser'));
    const body: SubscriptionActionResponse = {
      entitlements,
      status: 'pending_verification',
    };

    return context.json(toSuccessResponse(body));
  });

  route.post('/restore', async (context) => {
    restoreSubscriptionRequestSchema.parse(await context.req.json()) satisfies RestoreSubscriptionRequest;
    const entitlements = await options.entitlementsService.getEntitlements(context.get('currentUser'));
    const body: SubscriptionActionResponse = {
      entitlements,
      status: 'pending_verification',
    };

    return context.json(toSuccessResponse(body));
  });

  return route;
}

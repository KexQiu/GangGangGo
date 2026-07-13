import { Hono } from 'hono';

import type {
  RestoreSubscriptionRequest,
  SubscriptionActionResponse,
  VerifySubscriptionRequest,
} from '@xiaotidu/contracts';

import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { EntitlementsService } from '../entitlements/entitlementsService.js';
import { restoreSubscriptionRequestSchema, verifySubscriptionRequestSchema } from './subscriptions.schemas.js';

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

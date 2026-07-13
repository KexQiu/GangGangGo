import { createRoute } from '@hono/zod-openapi';

import {
  restoreSubscriptionRequestSchema,
  subscriptionActionResponseSchema,
  verifySubscriptionRequestSchema,
  type SubscriptionActionResponse,
} from '@xiaotidu/contracts';

import { apiResponses, bearerSecurity, createOpenApiRouter, jsonRequest } from '../../http/openapi.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { EntitlementsService } from '../entitlements/entitlementsService.js';

type CreateSubscriptionsRouteOptions = {
  entitlementsService: EntitlementsService;
};

export function createSubscriptionsRoute(options: CreateSubscriptionsRouteOptions) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();

  route.openapi(
    createRoute({
      method: 'post',
      path: '/verify',
      request: { body: jsonRequest(verifySubscriptionRequestSchema) },
      responses: apiResponses(subscriptionActionResponseSchema),
      security: bearerSecurity,
      summary: '提交订阅校验',
    }),
    async (context) => {
      context.req.valid('json');
      const entitlements = await options.entitlementsService.getEntitlements(context.get('currentUser'));
      const body: SubscriptionActionResponse = {
        entitlements,
        status: 'pending_verification',
      };

      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'post',
      path: '/restore',
      request: { body: jsonRequest(restoreSubscriptionRequestSchema) },
      responses: apiResponses(subscriptionActionResponseSchema),
      security: bearerSecurity,
      summary: '恢复订阅',
    }),
    async (context) => {
      context.req.valid('json');
      const entitlements = await options.entitlementsService.getEntitlements(context.get('currentUser'));
      const body: SubscriptionActionResponse = {
        entitlements,
        status: 'pending_verification',
      };

      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

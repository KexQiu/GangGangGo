import { createRoute } from '@hono/zod-openapi';

import { growthEventsRequestSchema, growthEventsResponseSchema, type GrowthEventsResponse } from '@xiaotidu/contracts';

import { apiResponses, bearerSecurity, createOpenApiRouter, jsonRequest } from '../../http/openapi.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { GrowthEventService } from './growthEventService.js';

type CreateGrowthEventsRouteOptions = {
  growthEventService: GrowthEventService;
  requiresAuth?: boolean;
};

export function createGrowthEventsRoute(options: CreateGrowthEventsRouteOptions) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();

  route.openapi(
    createRoute({
      method: 'post',
      path: '/',
      request: { body: jsonRequest(growthEventsRequestSchema) },
      responses: apiResponses(growthEventsResponseSchema),
      ...(options.requiresAuth ? { security: bearerSecurity } : {}),
      summary: options.requiresAuth ? '提交登录用户增长事件' : '提交匿名增长事件',
    }),
    async (context) => {
      const userId = options.requiresAuth ? context.get('currentUser').id : undefined;
      const body: GrowthEventsResponse = await options.growthEventService.recordBatch(
        context.req.valid('json'),
        userId,
      );

      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

import { createRoute } from '@hono/zod-openapi';

import {
  registerPushTokenRequestSchema,
  registerPushTokenResponseSchema,
  type RegisterPushTokenResponse,
} from '@xiaotidu/contracts';

import { apiResponses, bearerSecurity, createOpenApiRouter, jsonRequest } from '../../http/openapi.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { PushTokenService } from './pushTokenService.js';

type CreatePushTokensRouteOptions = {
  pushTokenService: PushTokenService;
};

export function createPushTokensRoute(options: CreatePushTokensRouteOptions) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();

  route.openapi(
    createRoute({
      method: 'post',
      path: '/',
      request: { body: jsonRequest(registerPushTokenRequestSchema) },
      responses: apiResponses(registerPushTokenResponseSchema),
      security: bearerSecurity,
      summary: '注册 Push token',
    }),
    async (context) => {
      const body: RegisterPushTokenResponse = await options.pushTokenService.registerToken(
        context.get('currentUser'),
        context.req.valid('json'),
      );

      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

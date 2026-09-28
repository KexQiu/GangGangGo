import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

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
        context.get('sessionId'),
      );

      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'delete',
      path: '/{deviceId}',
      request: { params: z.object({ deviceId: z.string().min(1).max(120) }) },
      responses: apiResponses(z.object({ ok: z.literal(true) })),
      security: bearerSecurity,
      summary: '撤销当前设备在本会话中的 Push 绑定',
    }),
    async (context) => {
      await options.pushTokenService.revokeDevice(
        context.get('currentUser'),
        context.req.valid('param').deviceId,
        context.get('sessionId'),
      );
      return context.json(toSuccessResponse({ ok: true as const }), 200);
    },
  );
  return route;
}

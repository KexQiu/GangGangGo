import { createRoute } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  appleLoginRequestSchema,
  authResponseSchema,
  refreshSessionRequestSchema,
  type AuthResponse,
} from '@xiaotidu/contracts';

import { apiResponses, bearerSecurity, createOpenApiRouter, jsonRequest } from '../../http/openapi.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { UserRepository } from '../users/userRepository.js';
import type { AuthSessionService } from './authSessionService.js';
import type { AppleAuthService } from './appleAuthService.js';

type CreateAuthRouteOptions = {
  appleAuthService: AppleAuthService;
  authSessionService: AuthSessionService;
  authMiddleware?: MiddlewareHandler<{ Variables: AuthVariables }>;
  userRepository: UserRepository;
};

const passThroughMiddleware: MiddlewareHandler<{ Variables: AuthVariables }> = async (_context, next) => {
  await next();
};

export function createAuthRoute(options: CreateAuthRouteOptions) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();
  const authMiddleware = options.authMiddleware ?? passThroughMiddleware;

  route.openapi(
    createRoute({
      method: 'post',
      path: '/apple',
      request: { body: jsonRequest(appleLoginRequestSchema) },
      responses: apiResponses(authResponseSchema),
      summary: 'Apple 或开发 Mock 登录',
    }),
    async (context) => {
      const request = context.req.valid('json');
      const appleUser = await options.appleAuthService.verifyLogin(request);
      const user = await options.userRepository.upsertFromApple(appleUser);
      const body: AuthResponse = {
        session: await options.authSessionService.create(user.id),
        user: {
          avatarUrl: user.avatarUrl,
          id: user.id,
          nickname: user.nickname,
          timezone: user.timezone,
        },
      };

      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'post',
      path: '/refresh',
      request: { body: jsonRequest(refreshSessionRequestSchema) },
      responses: apiResponses(authResponseSchema),
      summary: '轮换登录会话',
    }),
    async (context) => {
      const request = context.req.valid('json');
      const rotated = await options.authSessionService.rotate(request.refreshToken);
      const user = await options.userRepository.findById(rotated.userId);
      if (!user) throw new Error('Session user not found.');
      const body: AuthResponse = {
        session: rotated.session,
        user: { avatarUrl: user.avatarUrl, id: user.id, nickname: user.nickname, timezone: user.timezone },
      };
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.use('/logout', authMiddleware);
  route.openapi(
    createRoute({
      method: 'post',
      path: '/logout',
      responses: apiResponses(z.object({ ok: z.literal(true) })),
      security: bearerSecurity,
      summary: '撤销当前会话',
    }),
    async (context) => {
      await options.authSessionService.revoke(context.get('sessionId'));
      return context.json(toSuccessResponse({ ok: true as const }), 200);
    },
  );

  return route;
}

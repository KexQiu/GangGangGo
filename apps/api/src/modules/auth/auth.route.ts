import { Hono, type MiddlewareHandler } from 'hono';

import type { AuthResponse } from '@xiaotidu/contracts';

import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { UserRepository } from '../users/userRepository.js';
import { appleLoginRequestSchema } from './auth.schemas.js';
import type { AppleAuthService } from './appleAuthService.js';
import { issueAccessToken } from './token.js';

type CreateAuthRouteOptions = {
  appleAuthService: AppleAuthService;
  authMiddleware?: MiddlewareHandler<{ Variables: AuthVariables }>;
  userRepository: UserRepository;
};

const passThroughMiddleware: MiddlewareHandler<{ Variables: AuthVariables }> = async (_context, next) => {
  await next();
};

export function createAuthRoute(options: CreateAuthRouteOptions) {
  const route = new Hono();
  const authMiddleware = options.authMiddleware ?? passThroughMiddleware;

  route.post('/apple', async (context) => {
    const request = appleLoginRequestSchema.parse(await context.req.json());
    const appleUser = await options.appleAuthService.verifyLogin(request);
    const user = await options.userRepository.upsertFromApple(appleUser);
    const body: AuthResponse = {
      token: issueAccessToken(user.id),
      user: {
        avatarUrl: user.avatarUrl,
        id: user.id,
        nickname: user.nickname,
        timezone: user.timezone,
      },
    };

    return context.json(toSuccessResponse(body));
  });

  route.post('/logout', authMiddleware, (context) => context.json(toSuccessResponse({ ok: true })));

  return route;
}

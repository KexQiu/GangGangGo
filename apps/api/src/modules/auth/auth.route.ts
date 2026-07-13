import { Hono, type MiddlewareHandler } from 'hono';

import type { AuthResponse } from '@xiaotidu/contracts';

import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { UserRepository } from '../users/userRepository.js';
import { appleLoginRequestSchema, logoutRequestSchema, refreshSessionRequestSchema } from './auth.schemas.js';
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
  const route = new Hono();
  const authMiddleware = options.authMiddleware ?? passThroughMiddleware;

  route.post('/apple', async (context) => {
    const request = appleLoginRequestSchema.parse(await context.req.json());
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

    return context.json(toSuccessResponse(body));
  });

  route.post('/refresh', async (context) => {
    const request = refreshSessionRequestSchema.parse(await context.req.json());
    const rotated = await options.authSessionService.rotate(request.refreshToken);
    const user = await options.userRepository.findById(rotated.userId);
    if (!user) throw new Error('Session user not found.');
    const body: AuthResponse = {
      session: rotated.session,
      user: { avatarUrl: user.avatarUrl, id: user.id, nickname: user.nickname, timezone: user.timezone },
    };
    return context.json(toSuccessResponse(body));
  });

  route.post('/logout', authMiddleware, async (context) => {
    logoutRequestSchema.parse(await context.req.json().catch(() => ({})));
    await options.authSessionService.revoke(context.get('sessionId'));
    return context.json(toSuccessResponse({ ok: true }));
  });

  return route;
}

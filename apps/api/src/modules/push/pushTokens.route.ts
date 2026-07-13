import { Hono } from 'hono';

import type { RegisterPushTokenRequest, RegisterPushTokenResponse } from '@xiaotidu/contracts';

import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { PushTokenService } from './pushTokenService.js';
import { registerPushTokenRequestSchema } from './pushTokens.schemas.js';

type CreatePushTokensRouteOptions = {
  pushTokenService: PushTokenService;
};

export function createPushTokensRoute(options: CreatePushTokensRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();

  route.post('/', async (context) => {
    const request = registerPushTokenRequestSchema.parse(await context.req.json()) satisfies RegisterPushTokenRequest;
    const body: RegisterPushTokenResponse = await options.pushTokenService.registerToken(
      context.get('currentUser'),
      request,
    );

    return context.json(toSuccessResponse(body));
  });

  return route;
}

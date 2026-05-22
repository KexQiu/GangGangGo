import { Hono } from 'hono';
import { z } from 'zod';

import type {
  RegisterPushTokenRequest,
  RegisterPushTokenResponse,
} from '@xiaotidu/contracts';

import type { AuthVariables } from '../http/middleware/auth.js';
import { toSuccessResponse } from '../http/responses.js';
import type { PushTokenService } from '../modules/push/pushTokenService.js';

const registerPushTokenRequestSchema = z.object({
  deviceId: z.string().min(1).max(120).optional(),
  platform: z.union([z.literal('ios'), z.literal('android')]),
  provider: z.union([z.literal('expo'), z.literal('apns')]),
  token: z.string().min(1).max(300),
});

type CreatePushTokensRouteOptions = {
  pushTokenService: PushTokenService;
};

export function createPushTokensRoute(options: CreatePushTokensRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();

  route.post('/', async (context) => {
    const request = registerPushTokenRequestSchema.parse(
      await context.req.json(),
    ) satisfies RegisterPushTokenRequest;
    const body: RegisterPushTokenResponse = await options.pushTokenService.registerToken(
      context.get('currentUser'),
      request,
    );

    return context.json(toSuccessResponse(body));
  });

  return route;
}

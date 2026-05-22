import { Hono } from 'hono';

import type { EntitlementsResponse, UserProfile } from '@xiaotidu/contracts';

import type { AuthVariables } from '../http/middleware/auth.js';
import { toSuccessResponse } from '../http/responses.js';
import type { EntitlementsService } from '../modules/entitlements/entitlementsService.js';

type CreateMeRouteOptions = {
  entitlementsService: EntitlementsService;
};

export function createMeRoute(options: CreateMeRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();

  route.get('/', (context) => {
    const currentUser = context.get('currentUser');
    const body: UserProfile = {
      avatarUrl: currentUser.avatarUrl,
      id: currentUser.id,
      nickname: currentUser.nickname,
      timezone: currentUser.timezone,
    };

    return context.json(toSuccessResponse(body));
  });

  route.get('/entitlements', async (context) => {
    const body: EntitlementsResponse = await options.entitlementsService.getEntitlements(context.get('currentUser'));

    return context.json(toSuccessResponse(body));
  });

  return route;
}

import { Hono } from 'hono';

import type { EntitlementsResponse } from '@xiaotidu/contracts';

import { toSuccessResponse } from '../http/responses.js';

export const meRoute = new Hono();

meRoute.get('/entitlements', (context) => {
  const body: EntitlementsResponse = {
    proStatus: 'free',
  };

  return context.json(toSuccessResponse(body));
});

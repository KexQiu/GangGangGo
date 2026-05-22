import { Hono } from 'hono';

import type { ApiHealthResponse } from '@xiaotidu/contracts';

import { apiVersion } from '../config/version.js';
import { toSuccessResponse } from '../http/responses.js';

export const healthRoute = new Hono();

healthRoute.get('/health', (context) => {
  const body: ApiHealthResponse = {
    ok: true,
    service: 'xiaotidu-api',
    version: apiVersion,
  };

  return context.json(toSuccessResponse(body));
});

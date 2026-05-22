import { Hono } from 'hono';

import type { ApiHealthResponse } from '@xiaotidu/contracts';

import { apiVersion } from '../config/version.js';
import { checkDatabaseHealth, type DatabaseHealthChecker } from '../db/health.js';
import { toSuccessResponse } from '../http/responses.js';

type CreateHealthRouteOptions = {
  databaseHealthChecker?: DatabaseHealthChecker;
};

export function createHealthRoute(options: CreateHealthRouteOptions = {}) {
  const route = new Hono();
  const databaseHealthChecker = options.databaseHealthChecker ?? checkDatabaseHealth;

  route.get('/health', (context) => {
    const body: ApiHealthResponse = {
      ok: true,
      service: 'xiaotidu-api',
      version: apiVersion,
    };

    return context.json(toSuccessResponse(body));
  });

  route.get('/health/db', async (context) => {
    const body = await databaseHealthChecker();

    return context.json(toSuccessResponse(body));
  });

  return route;
}

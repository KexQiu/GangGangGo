import { createRoute } from '@hono/zod-openapi';

import { apiHealthResponseSchema, databaseHealthResponseSchema, type ApiHealthResponse } from '@xiaotidu/contracts';

import { apiVersion } from '../../config/version.js';
import { checkDatabaseHealth, type DatabaseHealthChecker } from '../../db/health.js';
import { apiResponses, createOpenApiRouter } from '../../http/openapi.js';
import { toSuccessResponse } from '../../http/responses.js';

type CreateHealthRouteOptions = {
  databaseHealthChecker?: DatabaseHealthChecker;
};

export function createHealthRoute(options: CreateHealthRouteOptions = {}) {
  const route = createOpenApiRouter();
  const databaseHealthChecker = options.databaseHealthChecker ?? checkDatabaseHealth;

  route.openapi(
    createRoute({
      method: 'get',
      path: '/health',
      responses: apiResponses(apiHealthResponseSchema),
      summary: '服务健康检查',
    }),
    (context) => {
      const body: ApiHealthResponse = {
        ok: true,
        service: 'xiaotidu-api',
        version: apiVersion,
      };

      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/health/db',
      responses: apiResponses(databaseHealthResponseSchema),
      summary: '数据库健康检查',
    }),
    async (context) => {
      const body = await databaseHealthChecker();

      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

import {
  dataSyncPullResponseSchema,
  dataSyncPushRequestSchema,
  dataSyncPushResponseSchema,
  type DataSyncPullResponse,
  type DataSyncPushResponse,
} from '@xiaotidu/contracts';

import { apiResponses, bearerSecurity, createOpenApiRouter, jsonRequest } from '../../http/openapi.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { DataSyncService } from './dataSyncService.js';

export function createDataSyncRoute(options: { dataSyncService: DataSyncService }) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();

  route.openapi(
    createRoute({
      method: 'put',
      path: '/push',
      request: { body: jsonRequest(dataSyncPushRequestSchema) },
      responses: apiResponses(dataSyncPushResponseSchema),
      security: bearerSecurity,
      summary: '上传完整记录变更',
    }),
    async (context) => {
      const input = context.req.valid('json');
      const body: DataSyncPushResponse = await options.dataSyncService.push(
        context.get('currentUser'),
        input.mutations,
        input.timeZone,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/pull',
      request: { query: z.object({ cursor: z.string().default('0') }) },
      responses: apiResponses(dataSyncPullResponseSchema),
      security: bearerSecurity,
      summary: '增量拉取完整记录',
    }),
    async (context) => {
      const body: DataSyncPullResponse = await options.dataSyncService.pull(
        context.get('currentUser'),
        context.req.valid('query').cursor,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

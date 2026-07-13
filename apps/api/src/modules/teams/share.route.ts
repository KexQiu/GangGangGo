import { createRoute } from '@hono/zod-openapi';

import {
  dailyShareSnapshotResponseSchema,
  shareSettingsResponseSchema,
  shareSettingsSchema,
  upsertDailyShareSnapshotRequestSchema,
  type DailyShareSnapshotResponse,
  type ShareSettingsResponse,
} from '@xiaotidu/contracts';

import { apiResponses, bearerSecurity, createOpenApiRouter, jsonRequest } from '../../http/openapi.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { TeamService } from './teamService.js';

type CreateShareSettingsRouteOptions = {
  teamService: TeamService;
};

type CreateShareSnapshotsRouteOptions = {
  teamService: TeamService;
};

export function createShareSettingsRoute(options: CreateShareSettingsRouteOptions) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();

  route.openapi(
    createRoute({
      method: 'put',
      path: '/',
      request: { body: jsonRequest(shareSettingsSchema) },
      responses: apiResponses(shareSettingsResponseSchema),
      security: bearerSecurity,
      summary: '更新共享设置',
    }),
    async (context) => {
      const body: ShareSettingsResponse = await options.teamService.updateShareSettings(
        context.get('currentUser'),
        context.req.valid('json'),
      );

      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

export function createShareSnapshotsRoute(options: CreateShareSnapshotsRouteOptions) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();

  route.openapi(
    createRoute({
      method: 'put',
      path: '/today',
      request: { body: jsonRequest(upsertDailyShareSnapshotRequestSchema) },
      responses: apiResponses(dailyShareSnapshotResponseSchema),
      security: bearerSecurity,
      summary: '上传今日共享快照',
    }),
    async (context) => {
      const request = context.req.valid('json');
      const body: DailyShareSnapshotResponse = await options.teamService.upsertDailyShareSnapshot(
        context.get('currentUser'),
        request.snapshot,
      );

      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

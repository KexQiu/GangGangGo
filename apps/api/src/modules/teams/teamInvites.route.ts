import { createRoute } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  acceptTeamInviteRequestSchema,
  teamInvitePreviewResponseSchema,
  teamResponseSchema,
  type AcceptTeamInviteResponse,
  type TeamInvitePreviewResponse,
} from '@xiaotidu/contracts';

import { apiResponses, bearerSecurity, createOpenApiRouter, jsonRequest } from '../../http/openapi.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { TeamService } from './teamService.js';
import { teamInviteTokenSchema } from './teams.schemas.js';

type CreateTeamInvitesRouteOptions = {
  authMiddleware: MiddlewareHandler<{ Variables: AuthVariables }>;
  teamService: TeamService;
};

export function createTeamInvitesRoute(options: CreateTeamInvitesRouteOptions) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();
  const tokenParams = z.object({ token: teamInviteTokenSchema });

  route.openapi(
    createRoute({
      method: 'get',
      path: '/{token}',
      request: { params: tokenParams },
      responses: apiResponses(teamInvitePreviewResponseSchema),
      summary: '预览邀请',
    }),
    async (context) => {
      const body: TeamInvitePreviewResponse = await options.teamService.previewInvite(context.req.valid('param').token);

      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.use('/:token/accept', options.authMiddleware);
  route.openapi(
    createRoute({
      method: 'post',
      path: '/{token}/accept',
      request: { body: jsonRequest(acceptTeamInviteRequestSchema), params: tokenParams },
      responses: apiResponses(teamResponseSchema),
      security: bearerSecurity,
      summary: '接受邀请',
    }),
    async (context) => {
      const body: AcceptTeamInviteResponse = await options.teamService.acceptInvite(
        context.get('currentUser'),
        context.req.valid('param').token,
        context.req.valid('json'),
      );

      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

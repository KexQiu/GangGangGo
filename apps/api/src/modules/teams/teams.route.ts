import { createRoute } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  createTeamInviteResponseSchema,
  createTeamRequestSchema,
  teamResponseSchema,
  teamSnapshotsResponseSchema,
  updateTeamMemberStatusRequestSchema,
  updateTeamRequestSchema,
  type CreateTeamInviteResponse,
  type TeamResponse,
  type TeamSnapshotsResponse,
} from '@xiaotidu/contracts';

import { apiResponses, bearerSecurity, createOpenApiRouter, jsonRequest } from '../../http/openapi.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { TeamService } from './teamService.js';
import { teamDateSchema, teamMemberIdSchema } from './teams.schemas.js';

type CreateTeamsRouteOptions = {
  proMiddleware?: MiddlewareHandler<{ Variables: AuthVariables }>;
  teamService: TeamService;
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

const passThroughMiddleware: MiddlewareHandler<{ Variables: AuthVariables }> = async (_context, next) => {
  await next();
};

export function createTeamsRoute(options: CreateTeamsRouteOptions) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();
  const proMiddleware = options.proMiddleware ?? passThroughMiddleware;
  const secured = bearerSecurity;

  route.openapi(
    createRoute({
      method: 'post',
      middleware: [proMiddleware],
      path: '/',
      request: { body: jsonRequest(createTeamRequestSchema) },
      responses: apiResponses(teamResponseSchema),
      security: secured,
      summary: '创建小队',
    }),
    async (context) => {
      const body: TeamResponse = await options.teamService.createTeam(
        context.get('currentUser'),
        context.req.valid('json'),
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/current',
      responses: apiResponses(teamResponseSchema),
      security: secured,
      summary: '当前小队',
    }),
    async (context) => {
      const body: TeamResponse = await options.teamService.getCurrentTeam(context.get('currentUser'));
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'patch',
      path: '/current',
      request: { body: jsonRequest(updateTeamRequestSchema) },
      responses: apiResponses(teamResponseSchema),
      security: secured,
      summary: '更新小队',
    }),
    async (context) => {
      const body: TeamResponse = await options.teamService.updateTeam(
        context.get('currentUser'),
        context.req.valid('json'),
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'post',
      path: '/current/leave',
      responses: apiResponses(teamResponseSchema),
      security: secured,
      summary: '退出小队',
    }),
    async (context) => {
      const body: TeamResponse = await options.teamService.leaveTeam(context.get('currentUser'));
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'post',
      middleware: [proMiddleware],
      path: '/current/invites',
      responses: apiResponses(createTeamInviteResponseSchema),
      security: secured,
      summary: '创建邀请',
    }),
    async (context) => {
      const body: CreateTeamInviteResponse = await options.teamService.createInvite(context.get('currentUser'));
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'delete',
      path: '/current/members/{memberId}',
      request: { params: z.object({ memberId: teamMemberIdSchema }) },
      responses: apiResponses(teamResponseSchema),
      security: secured,
      summary: '移除小队成员',
    }),
    async (context) => {
      const body: TeamResponse = await options.teamService.removeMember(
        context.get('currentUser'),
        context.req.valid('param').memberId,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'patch',
      path: '/current/members/me/status',
      request: { body: jsonRequest(updateTeamMemberStatusRequestSchema) },
      responses: apiResponses(teamResponseSchema),
      security: secured,
      summary: '更新当前成员状态',
    }),
    async (context) => {
      const body: TeamResponse = await options.teamService.setCurrentMemberStatus(
        context.get('currentUser'),
        context.req.valid('json').status,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/current/snapshots',
      request: { query: z.object({ date: teamDateSchema.optional() }) },
      responses: apiResponses(teamSnapshotsResponseSchema),
      security: secured,
      summary: '小队今日快照',
    }),
    async (context) => {
      const date = context.req.valid('query').date ?? getTodayDate();
      const body: TeamSnapshotsResponse = await options.teamService.getCurrentTeamSnapshots(
        context.get('currentUser'),
        date,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

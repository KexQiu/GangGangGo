import { createRoute } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ackBuddyNudgeRequestSchema,
  buddyNudgeAckResponseSchema,
  buddyNudgeSchema,
  buddyNudgeSettingsResponseSchema,
  buddyNudgeThreadResponseSchema,
  buddyNudgesResponseSchema,
  createBuddyNudgeRequestSchema,
  nudgeThreadsResponseSchema,
  updateBuddyNudgeSettingsRequestSchema,
  type BuddyNudge,
  type BuddyNudgeAckResponse,
  type BuddyNudgeSettingsResponse,
  type BuddyNudgeThreadResponse,
  type BuddyNudgesResponse,
  type NudgeThreadsResponse,
} from '@xiaotidu/contracts';

import { apiResponses, bearerSecurity, createOpenApiRouter, jsonRequest } from '../../http/openapi.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { NudgeService } from './nudgeService.js';
import { listNudgeThreadQuerySchema, nudgeIdSchema, nudgeUserIdSchema } from './nudges.schemas.js';

type CreateNudgesRouteOptions = {
  nudgeService: NudgeService;
  proMiddleware?: MiddlewareHandler<{ Variables: AuthVariables }>;
};

const passThroughMiddleware: MiddlewareHandler<{ Variables: AuthVariables }> = async (_context, next) => {
  await next();
};

export function createNudgesRoute(options: CreateNudgesRouteOptions) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();
  const proMiddleware = options.proMiddleware ?? passThroughMiddleware;

  route.openapi(
    createRoute({
      method: 'post',
      middleware: [proMiddleware],
      path: '/',
      request: { body: jsonRequest(createBuddyNudgeRequestSchema) },
      responses: apiResponses(buddyNudgeSchema),
      security: bearerSecurity,
      summary: '发送搭子提醒',
    }),
    async (context) => {
      const body: BuddyNudge = await options.nudgeService.createNudge(
        context.get('currentUser'),
        context.req.valid('json'),
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/inbox',
      responses: apiResponses(buddyNudgesResponseSchema),
      security: bearerSecurity,
      summary: '提醒收件箱',
    }),
    async (context) => {
      const body: BuddyNudgesResponse = await options.nudgeService.listInbox(context.get('currentUser'));
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/sent',
      responses: apiResponses(buddyNudgesResponseSchema),
      security: bearerSecurity,
      summary: '提醒发件箱',
    }),
    async (context) => {
      const body: BuddyNudgesResponse = await options.nudgeService.listSent(context.get('currentUser'));
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/threads',
      responses: apiResponses(nudgeThreadsResponseSchema),
      security: bearerSecurity,
      summary: '提醒会话摘要',
    }),
    async (context) => {
      const body: NudgeThreadsResponse = await options.nudgeService.listThreads(context.get('currentUser'));
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/threads/{buddyUserId}',
      request: {
        params: z.object({ buddyUserId: nudgeUserIdSchema }),
        query: listNudgeThreadQuerySchema,
      },
      responses: apiResponses(buddyNudgeThreadResponseSchema),
      security: bearerSecurity,
      summary: '提醒会话详情',
    }),
    async (context) => {
      const query = context.req.valid('query');
      const body: BuddyNudgeThreadResponse = await options.nudgeService.listThread(
        context.get('currentUser'),
        context.req.valid('param').buddyUserId,
        {
          ...(query.before ? { before: new Date(query.before) } : {}),
          limit: query.limit,
        },
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'post',
      path: '/{id}/ack',
      request: {
        body: jsonRequest(ackBuddyNudgeRequestSchema),
        params: z.object({ id: nudgeIdSchema }),
      },
      responses: apiResponses(buddyNudgeAckResponseSchema),
      security: bearerSecurity,
      summary: '回复提醒',
    }),
    async (context) => {
      const body: BuddyNudgeAckResponse = await options.nudgeService.ackNudge(
        context.get('currentUser'),
        context.req.valid('param').id,
        context.req.valid('json').status,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

export function createBuddyNudgeSettingsRoute(options: CreateNudgesRouteOptions) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();

  route.openapi(
    createRoute({
      method: 'get',
      path: '/',
      responses: apiResponses(buddyNudgeSettingsResponseSchema),
      security: bearerSecurity,
      summary: '提醒设置',
    }),
    async (context) => {
      const body: BuddyNudgeSettingsResponse = await options.nudgeService.getSettings(context.get('currentUser'));
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'put',
      path: '/{buddyUserId}',
      request: {
        body: jsonRequest(updateBuddyNudgeSettingsRequestSchema),
        params: z.object({ buddyUserId: nudgeUserIdSchema }),
      },
      responses: apiResponses(buddyNudgeSettingsResponseSchema),
      security: bearerSecurity,
      summary: '更新提醒设置',
    }),
    async (context) => {
      const body: BuddyNudgeSettingsResponse = await options.nudgeService.updateSettings(
        context.get('currentUser'),
        context.req.valid('param').buddyUserId,
        context.req.valid('json'),
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

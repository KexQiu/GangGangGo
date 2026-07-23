import { createRoute } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ackFriendNudgeRequestSchema,
  createFriendInviteResponseSchema,
  createFriendNudgeRequestSchema,
  friendDataResponseSchema,
  friendEventSchema,
  friendEventsResponseSchema,
  friendInvitePreviewResponseSchema,
  friendNudgeAckResponseSchema,
  friendResponseSchema,
  friendsResponseSchema,
  updateFriendSettingsRequestSchema,
  type CreateFriendInviteResponse,
  type FriendDataResponse,
  type FriendEvent,
  type FriendEventsResponse,
  type FriendInvitePreviewResponse,
  type FriendNudgeAckResponse,
  type FriendResponse,
  type FriendsResponse,
} from '@xiaotidu/contracts';

import { apiResponses, bearerSecurity, createOpenApiRouter, jsonRequest } from '../../http/openapi.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { FriendService } from './friendService.js';

const friendUserIdSchema = z.string().uuid();
const inviteTokenSchema = z.string().min(16).max(120);
const eventIdSchema = z.string().uuid();
const eventsQuerySchema = z.object({
  before: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
const deleteFriendResponseSchema = z.object({ deleted: z.literal(true) }).strict();

export function createFriendInvitesRoute(options: {
  authMiddleware: MiddlewareHandler<{ Variables: AuthVariables }>;
  friendService: FriendService;
}) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();
  const tokenParams = z.object({ token: inviteTokenSchema });

  route.use('/', options.authMiddleware);
  route.openapi(
    createRoute({
      method: 'post',
      path: '/',
      responses: apiResponses(createFriendInviteResponseSchema),
      security: bearerSecurity,
      summary: '创建好友邀请',
    }),
    async (context) => {
      const body: CreateFriendInviteResponse = await options.friendService.createInvite(context.get('currentUser'));
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/{token}',
      request: { params: tokenParams },
      responses: apiResponses(friendInvitePreviewResponseSchema),
      summary: '预览好友邀请',
    }),
    async (context) => {
      const body: FriendInvitePreviewResponse = await options.friendService.previewInvite(
        context.req.valid('param').token,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.use('/:token/accept', options.authMiddleware);
  route.openapi(
    createRoute({
      method: 'post',
      path: '/{token}/accept',
      request: { params: tokenParams },
      responses: apiResponses(friendResponseSchema),
      security: bearerSecurity,
      summary: '接受好友邀请',
    }),
    async (context) => {
      const body: FriendResponse = await options.friendService.acceptInvite(
        context.get('currentUser'),
        context.req.valid('param').token,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

export function createFriendsRoute(options: { friendService: FriendService }) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();
  const friendParams = z.object({ friendUserId: friendUserIdSchema });

  route.openapi(
    createRoute({
      method: 'get',
      path: '/',
      responses: apiResponses(friendsResponseSchema),
      security: bearerSecurity,
      summary: '好友列表',
    }),
    async (context) => {
      const body: FriendsResponse = await options.friendService.listFriends(context.get('currentUser'));
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/{friendUserId}',
      request: { params: friendParams },
      responses: apiResponses(friendResponseSchema),
      security: bearerSecurity,
      summary: '好友详情',
    }),
    async (context) => {
      const body: FriendResponse = await options.friendService.getFriend(
        context.get('currentUser'),
        context.req.valid('param').friendUserId,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'patch',
      path: '/{friendUserId}/settings',
      request: { body: jsonRequest(updateFriendSettingsRequestSchema), params: friendParams },
      responses: apiResponses(friendResponseSchema),
      security: bearerSecurity,
      summary: '更新好友权限与提醒设置',
    }),
    async (context) => {
      const body: FriendResponse = await options.friendService.updateSettings(
        context.get('currentUser'),
        context.req.valid('param').friendUserId,
        context.req.valid('json'),
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/{friendUserId}/data',
      request: { params: friendParams },
      responses: apiResponses(friendDataResponseSchema),
      security: bearerSecurity,
      summary: '读取好友授权数据',
    }),
    async (context) => {
      const body: FriendDataResponse = await options.friendService.getFriendData(
        context.get('currentUser'),
        context.req.valid('param').friendUserId,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'delete',
      path: '/{friendUserId}',
      request: { params: friendParams },
      responses: apiResponses(deleteFriendResponseSchema),
      security: bearerSecurity,
      summary: '删除好友及互动历史',
    }),
    async (context) => {
      await options.friendService.deleteFriend(context.get('currentUser'), context.req.valid('param').friendUserId);
      return context.json(toSuccessResponse({ deleted: true as const }), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/{friendUserId}/events',
      request: { params: friendParams, query: eventsQuerySchema },
      responses: apiResponses(friendEventsResponseSchema),
      security: bearerSecurity,
      summary: '好友互动时间线',
    }),
    async (context) => {
      const query = context.req.valid('query');
      const body: FriendEventsResponse = await options.friendService.listEvents(
        context.get('currentUser'),
        context.req.valid('param').friendUserId,
        { ...(query.before ? { before: query.before } : {}), limit: query.limit },
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'post',
      path: '/{friendUserId}/nudges',
      request: { body: jsonRequest(createFriendNudgeRequestSchema), params: friendParams },
      responses: apiResponses(friendEventSchema),
      security: bearerSecurity,
      summary: '发送好友提醒',
    }),
    async (context) => {
      const body: FriendEvent = await options.friendService.sendNudge(
        context.get('currentUser'),
        context.req.valid('param').friendUserId,
        context.req.valid('json'),
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

export function createFriendEventsRoute(options: { friendService: FriendService }) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();
  route.openapi(
    createRoute({
      method: 'post',
      path: '/{eventId}/ack',
      request: {
        body: jsonRequest(ackFriendNudgeRequestSchema),
        params: z.object({ eventId: eventIdSchema }),
      },
      responses: apiResponses(friendNudgeAckResponseSchema),
      security: bearerSecurity,
      summary: '回复好友提醒',
    }),
    async (context) => {
      const body: FriendNudgeAckResponse = await options.friendService.ackNudge(
        context.get('currentUser'),
        context.req.valid('param').eventId,
        context.req.valid('json').status,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );
  return route;
}

import { Hono, type MiddlewareHandler } from 'hono';

import type {
  BuddyNudge,
  BuddyNudgeAckResponse,
  BuddyNudgeSettingsResponse,
  BuddyNudgeThreadResponse,
  BuddyNudgesResponse,
  NudgeThreadsResponse,
  CreateBuddyNudgeRequest,
  UpdateBuddyNudgeSettingsRequest,
} from '@xiaotidu/contracts';

import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { NudgeService } from './nudgeService.js';
import {
  ackBuddyNudgeRequestSchema,
  createBuddyNudgeRequestSchema,
  listNudgeThreadQuerySchema,
  nudgeIdSchema,
  nudgeUserIdSchema,
  updateBuddyNudgeSettingsRequestSchema,
} from './nudges.schemas.js';

type CreateNudgesRouteOptions = {
  nudgeService: NudgeService;
  proMiddleware?: MiddlewareHandler<{ Variables: AuthVariables }>;
};

const passThroughMiddleware: MiddlewareHandler<{ Variables: AuthVariables }> = async (_context, next) => {
  await next();
};

export function createNudgesRoute(options: CreateNudgesRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();
  const proMiddleware = options.proMiddleware ?? passThroughMiddleware;

  route.post('/', proMiddleware, async (context) => {
    const request = createBuddyNudgeRequestSchema.parse(await context.req.json()) satisfies CreateBuddyNudgeRequest;
    const body: BuddyNudge = await options.nudgeService.createNudge(context.get('currentUser'), request);

    return context.json(toSuccessResponse(body));
  });

  route.get('/inbox', async (context) => {
    const body: BuddyNudgesResponse = await options.nudgeService.listInbox(context.get('currentUser'));

    return context.json(toSuccessResponse(body));
  });

  route.get('/sent', async (context) => {
    const body: BuddyNudgesResponse = await options.nudgeService.listSent(context.get('currentUser'));

    return context.json(toSuccessResponse(body));
  });

  route.get('/threads', async (context) => {
    const body: NudgeThreadsResponse = await options.nudgeService.listThreads(context.get('currentUser'));
    return context.json(toSuccessResponse(body));
  });

  route.get('/threads/:buddyUserId', async (context) => {
    const buddyUserId = nudgeUserIdSchema.parse(context.req.param('buddyUserId'));
    const query = listNudgeThreadQuerySchema.parse({
      before: context.req.query('before'),
      limit: context.req.query('limit'),
    });
    const body: BuddyNudgeThreadResponse = await options.nudgeService.listThread(
      context.get('currentUser'),
      buddyUserId,
      {
        ...(query.before ? { before: new Date(query.before) } : {}),
        limit: query.limit,
      },
    );

    return context.json(toSuccessResponse(body));
  });

  route.post('/:id/ack', async (context) => {
    const nudgeId = nudgeIdSchema.parse(context.req.param('id'));
    const request = ackBuddyNudgeRequestSchema.parse(await context.req.json());
    const body: BuddyNudgeAckResponse = await options.nudgeService.ackNudge(
      context.get('currentUser'),
      nudgeId,
      request.status,
    );

    return context.json(toSuccessResponse(body));
  });

  return route;
}

export function createBuddyNudgeSettingsRoute(options: CreateNudgesRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();

  route.get('/', async (context) => {
    const body: BuddyNudgeSettingsResponse = await options.nudgeService.getSettings(context.get('currentUser'));

    return context.json(toSuccessResponse(body));
  });

  route.put('/:buddyUserId', async (context) => {
    const buddyUserId = nudgeUserIdSchema.parse(context.req.param('buddyUserId'));
    const request = updateBuddyNudgeSettingsRequestSchema.parse(
      await context.req.json(),
    ) satisfies UpdateBuddyNudgeSettingsRequest;
    const body: BuddyNudgeSettingsResponse = await options.nudgeService.updateSettings(
      context.get('currentUser'),
      buddyUserId,
      request,
    );

    return context.json(toSuccessResponse(body));
  });

  return route;
}

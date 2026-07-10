import { Hono, type MiddlewareHandler } from 'hono';

import type {
  CreateTeamInviteResponse,
  CreateTeamRequest,
  TeamResponse,
  TeamSnapshotsResponse,
  UpdateTeamMemberStatusRequest,
  UpdateTeamRequest,
} from '@xiaotidu/contracts';

import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { TeamService } from './teamService.js';
import {
  createTeamRequestSchema,
  teamDateSchema,
  teamMemberIdSchema,
  updateTeamMemberStatusRequestSchema,
  updateTeamRequestSchema,
} from './teams.schemas.js';

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
  const route = new Hono<{ Variables: AuthVariables }>();
  const proMiddleware = options.proMiddleware ?? passThroughMiddleware;

  route.post('/', proMiddleware, async (context) => {
    const request = createTeamRequestSchema.parse(await context.req.json()) satisfies CreateTeamRequest;
    const body: TeamResponse = await options.teamService.createTeam(context.get('currentUser'), request);

    return context.json(toSuccessResponse(body));
  });

  route.get('/current', async (context) => {
    const body: TeamResponse = await options.teamService.getCurrentTeam(context.get('currentUser'));

    return context.json(toSuccessResponse(body));
  });

  route.patch('/current', async (context) => {
    const request = updateTeamRequestSchema.parse(await context.req.json()) satisfies UpdateTeamRequest;
    const body: TeamResponse = await options.teamService.updateTeam(context.get('currentUser'), request);

    return context.json(toSuccessResponse(body));
  });

  route.post('/current/leave', async (context) => {
    const body: TeamResponse = await options.teamService.leaveTeam(context.get('currentUser'));

    return context.json(toSuccessResponse(body));
  });

  route.post('/current/invites', proMiddleware, async (context) => {
    const body: CreateTeamInviteResponse = await options.teamService.createInvite(context.get('currentUser'));

    return context.json(toSuccessResponse(body));
  });

  route.delete('/current/members/:memberId', async (context) => {
    const memberId = teamMemberIdSchema.parse(context.req.param('memberId'));
    const body: TeamResponse = await options.teamService.removeMember(context.get('currentUser'), memberId);

    return context.json(toSuccessResponse(body));
  });

  route.patch('/current/members/me/status', async (context) => {
    const request = updateTeamMemberStatusRequestSchema.parse(
      await context.req.json(),
    ) satisfies UpdateTeamMemberStatusRequest;
    const body: TeamResponse = await options.teamService.setCurrentMemberStatus(
      context.get('currentUser'),
      request.status,
    );

    return context.json(toSuccessResponse(body));
  });

  route.get('/current/snapshots', async (context) => {
    const date = teamDateSchema.optional().parse(context.req.query('date')) ?? getTodayDate();
    const body: TeamSnapshotsResponse = await options.teamService.getCurrentTeamSnapshots(
      context.get('currentUser'),
      date,
    );

    return context.json(toSuccessResponse(body));
  });

  return route;
}

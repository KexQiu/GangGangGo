import { Hono, type MiddlewareHandler } from 'hono';

import type { AcceptTeamInviteRequest, AcceptTeamInviteResponse, TeamInvitePreviewResponse } from '@xiaotidu/contracts';

import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { TeamService } from './teamService.js';
import { acceptTeamInviteRequestSchema, teamInviteTokenSchema } from './teams.schemas.js';

type CreateTeamInvitesRouteOptions = {
  authMiddleware: MiddlewareHandler<{ Variables: AuthVariables }>;
  teamService: TeamService;
};

export function createTeamInvitesRoute(options: CreateTeamInvitesRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();

  route.get('/:token', async (context) => {
    const token = teamInviteTokenSchema.parse(context.req.param('token'));
    const body: TeamInvitePreviewResponse = await options.teamService.previewInvite(token);

    return context.json(toSuccessResponse(body));
  });

  route.post('/:token/accept', options.authMiddleware, async (context) => {
    const token = teamInviteTokenSchema.parse(context.req.param('token'));
    const request = acceptTeamInviteRequestSchema.parse(await context.req.json()) satisfies AcceptTeamInviteRequest;
    const body: AcceptTeamInviteResponse = await options.teamService.acceptInvite(
      context.get('currentUser'),
      token,
      request,
    );

    return context.json(toSuccessResponse(body));
  });

  return route;
}

import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import type {
  AcceptTeamInviteRequest,
  AcceptTeamInviteResponse,
  TeamInvitePreviewResponse,
} from '@xiaotidu/contracts';

import type { AuthVariables } from '../http/middleware/auth.js';
import { toSuccessResponse } from '../http/responses.js';
import type { TeamService } from '../modules/teams/teamService.js';

const tokenSchema = z.string().min(16).max(256);

const acceptTeamInviteRequestSchema = z.object({
  displayName: z.string().min(1).max(40).optional(),
  shareSettings: z
    .object({
      paused: z.boolean().optional(),
      shareHabitCompletion: z.boolean().optional(),
      shareStreak: z.boolean().optional(),
      shareToiletRecorded: z.boolean().optional(),
      shareTraining: z.boolean().optional(),
    })
    .optional(),
});

type CreateTeamInvitesRouteOptions = {
  authMiddleware: MiddlewareHandler<{ Variables: AuthVariables }>;
  teamService: TeamService;
};

export function createTeamInvitesRoute(options: CreateTeamInvitesRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();

  route.get('/:token', async (context) => {
    const token = tokenSchema.parse(context.req.param('token'));
    const body: TeamInvitePreviewResponse = await options.teamService.previewInvite(token);

    return context.json(toSuccessResponse(body));
  });

  route.post('/:token/accept', options.authMiddleware, async (context) => {
    const token = tokenSchema.parse(context.req.param('token'));
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

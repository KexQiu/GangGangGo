import { Hono } from 'hono';

import type {
  DailyShareSnapshotResponse,
  ShareSettingsResponse,
  UpdateShareSettingsRequest,
  UpsertDailyShareSnapshotRequest,
} from '@xiaotidu/contracts';

import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { TeamService } from './teamService.js';
import { shareSettingsSchema, upsertDailyShareSnapshotSchema } from './teams.schemas.js';

type CreateShareSettingsRouteOptions = {
  teamService: TeamService;
};

type CreateShareSnapshotsRouteOptions = {
  teamService: TeamService;
};

export function createShareSettingsRoute(options: CreateShareSettingsRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();

  route.put('/', async (context) => {
    const request = shareSettingsSchema.parse(await context.req.json()) satisfies UpdateShareSettingsRequest;
    const body: ShareSettingsResponse = await options.teamService.updateShareSettings(
      context.get('currentUser'),
      request,
    );

    return context.json(toSuccessResponse(body));
  });

  return route;
}

export function createShareSnapshotsRoute(options: CreateShareSnapshotsRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();

  route.put('/today', async (context) => {
    const request = upsertDailyShareSnapshotSchema.parse(
      await context.req.json(),
    ) satisfies UpsertDailyShareSnapshotRequest;
    const body: DailyShareSnapshotResponse = await options.teamService.upsertDailyShareSnapshot(
      context.get('currentUser'),
      request.snapshot,
    );

    return context.json(toSuccessResponse(body));
  });

  return route;
}

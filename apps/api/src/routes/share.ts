import { Hono } from 'hono';
import { z } from 'zod';

import type {
  DailyShareSnapshotResponse,
  ShareSettingsResponse,
  UpdateShareSettingsRequest,
  UpsertDailyShareSnapshotRequest,
} from '@xiaotidu/contracts';

import type { AuthVariables } from '../http/middleware/auth.js';
import { toSuccessResponse } from '../http/responses.js';
import type { TeamService } from '../modules/teams/teamService.js';

const shareSettingsSchema = z.object({
  paused: z.boolean(),
  shareHabitCompletion: z.boolean(),
  shareStreak: z.boolean(),
  shareToiletRecorded: z.boolean(),
  shareTraining: z.boolean(),
});

const dailyShareSnapshotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  habitCompletion: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  streakDays: z.number().int().min(0),
  toiletRecorded: z.boolean(),
  trainingDone: z.boolean(),
});

const upsertDailyShareSnapshotSchema = z.object({
  snapshot: dailyShareSnapshotSchema,
});

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

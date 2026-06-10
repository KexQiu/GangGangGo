import { Hono } from 'hono';
import { z } from 'zod';

import type {
  AdvancedReportResponse,
  DailyReportSnapshotResponse,
  DailyReportSnapshotsBulkResponse,
  ProStatus,
  TeamWeeklyReportResponse,
  UpsertDailyReportSnapshotRequest,
  UpsertDailyReportSnapshotsBulkRequest,
} from '@xiaotidu/contracts';

import { ApiError } from '../http/apiError.js';
import type { AuthVariables } from '../http/middleware/auth.js';
import { toSuccessResponse } from '../http/responses.js';
import type { EntitlementsService } from '../modules/entitlements/entitlementsService.js';
import type { ReportService } from '../modules/reports/reportService.js';

const advancedReportRangeSchema = z.literal('90d').default('90d');
const zeroToFourSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const zeroToSevenSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);
const dailyReportSnapshotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  habitCompletion: zeroToFourSchema,
  habitFull: z.boolean(),
  ninetyDayHabitFullDays: z.number().int().min(0).max(90),
  ninetyDayToiletLongMeetingCount: z.number().int().min(0),
  ninetyDayTrainingDays: z.number().int().min(0).max(90),
  streakDays: z.number().int().min(0),
  thirtyDayHabitFullDays: z.number().int().min(0).max(30),
  thirtyDayToiletLongMeetingCount: z.number().int().min(0),
  thirtyDayTrainingDays: z.number().int().min(0).max(30),
  toiletLongMeeting: z.boolean(),
  toiletRecorded: z.boolean(),
  trainingDone: z.boolean(),
  weeklyHabitFullDays: zeroToSevenSchema,
  weeklyToiletLongMeetingCount: z.number().int().min(0),
  weeklyTrainingDays: zeroToSevenSchema,
});
const upsertDailyReportSnapshotSchema = z.object({
  snapshot: dailyReportSnapshotSchema,
});
const upsertDailyReportSnapshotsBulkSchema = z.object({
  snapshots: z.array(dailyReportSnapshotSchema).min(1).max(90),
});

type CreateReportsRouteOptions = {
  entitlementsService: EntitlementsService;
  reportService: ReportService;
};

async function requirePro(
  entitlementsService: EntitlementsService,
  currentUser: AuthVariables['currentUser'],
) {
  const entitlements = await entitlementsService.getEntitlements(currentUser);
  const allowedStatuses: ProStatus[] = ['pro_active', 'pro_grace_period'];

  if (!allowedStatuses.includes(entitlements.proStatus)) {
    throw new ApiError(403, 'forbidden', '这是小提督 Pro 功能。');
  }
}

export function createReportsRoute(options: CreateReportsRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();

  route.get('/reports/advanced', async (context) => {
    const currentUser = context.get('currentUser');
    const range = advancedReportRangeSchema.parse(context.req.query('range') ?? '90d');

    await requirePro(options.entitlementsService, currentUser);

    const body: AdvancedReportResponse = await options.reportService.getAdvancedReport(currentUser, range);

    return context.json(toSuccessResponse(body));
  });

  route.get('/teams/current/reports/weekly', async (context) => {
    const currentUser = context.get('currentUser');

    await requirePro(options.entitlementsService, currentUser);

    const body: TeamWeeklyReportResponse = await options.reportService.getTeamWeeklyReport(currentUser);

    return context.json(toSuccessResponse(body));
  });

  route.put('/report-snapshots/today', async (context) => {
    const currentUser = context.get('currentUser');
    const request = upsertDailyReportSnapshotSchema.parse(
      await context.req.json(),
    ) satisfies UpsertDailyReportSnapshotRequest;

    await requirePro(options.entitlementsService, currentUser);

    const body: DailyReportSnapshotResponse = await options.reportService.upsertDailyReportSnapshot(
      currentUser,
      request.snapshot,
    );

    return context.json(toSuccessResponse(body));
  });

  route.put('/report-snapshots/bulk', async (context) => {
    const currentUser = context.get('currentUser');
    const request = upsertDailyReportSnapshotsBulkSchema.parse(
      await context.req.json(),
    ) satisfies UpsertDailyReportSnapshotsBulkRequest;

    await requirePro(options.entitlementsService, currentUser);

    const body: DailyReportSnapshotsBulkResponse = await options.reportService.upsertDailyReportSnapshots(
      currentUser,
      request.snapshots,
    );

    return context.json(toSuccessResponse(body));
  });

  return route;
}

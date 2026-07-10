import { Hono } from 'hono';

import type {
  AdvancedReportResponse,
  DailyReportSnapshotResponse,
  DailyReportSnapshotsBulkResponse,
  ProStatus,
  TeamWeeklyReportResponse,
  UpsertDailyReportSnapshotRequest,
  UpsertDailyReportSnapshotsBulkRequest,
} from '@xiaotidu/contracts';

import { ApiError } from '../../http/apiError.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { EntitlementsService } from '../entitlements/entitlementsService.js';
import type { ReportService } from './reportService.js';
import {
  advancedReportRangeSchema,
  upsertDailyReportSnapshotsBulkSchema,
  upsertDailyReportSnapshotSchema,
} from './reports.schemas.js';

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

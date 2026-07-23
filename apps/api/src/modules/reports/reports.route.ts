import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

import {
  advancedReportRangeSchema,
  advancedReportResponseSchema,
  dailyReportSnapshotResponseSchema,
  dailyReportSnapshotsBulkResponseSchema,
  upsertDailyReportSnapshotRequestSchema,
  upsertDailyReportSnapshotsBulkRequestSchema,
  type AdvancedReportResponse,
  type DailyReportSnapshotResponse,
  type DailyReportSnapshotsBulkResponse,
  type ProStatus,
} from '@xiaotidu/contracts';

import { ApiError } from '../../http/apiError.js';
import { apiResponses, bearerSecurity, createOpenApiRouter, jsonRequest } from '../../http/openapi.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { EntitlementsService } from '../entitlements/entitlementsService.js';
import type { ReportService } from './reportService.js';

type CreateReportsRouteOptions = {
  entitlementsService: EntitlementsService;
  reportService: ReportService;
};

async function requirePro(entitlementsService: EntitlementsService, currentUser: AuthVariables['currentUser']) {
  const entitlements = await entitlementsService.getEntitlements(currentUser);
  const allowedStatuses: ProStatus[] = ['pro_active', 'pro_grace_period'];

  if (!allowedStatuses.includes(entitlements.proStatus)) {
    throw new ApiError(403, 'forbidden', '这是小提督 Pro 功能。');
  }
}

export function createReportsRoute(options: CreateReportsRouteOptions) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();

  route.openapi(
    createRoute({
      method: 'get',
      path: '/reports/advanced',
      request: { query: z.object({ range: advancedReportRangeSchema.default('90d') }) },
      responses: apiResponses(advancedReportResponseSchema),
      security: bearerSecurity,
      summary: '90 天高级报告',
    }),
    async (context) => {
      const currentUser = context.get('currentUser');
      await requirePro(options.entitlementsService, currentUser);
      const body: AdvancedReportResponse = await options.reportService.getAdvancedReport(
        currentUser,
        context.req.valid('query').range,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'put',
      path: '/report-snapshots/today',
      request: { body: jsonRequest(upsertDailyReportSnapshotRequestSchema) },
      responses: apiResponses(dailyReportSnapshotResponseSchema),
      security: bearerSecurity,
      summary: '上传个人日报',
    }),
    async (context) => {
      const currentUser = context.get('currentUser');
      await requirePro(options.entitlementsService, currentUser);
      const body: DailyReportSnapshotResponse = await options.reportService.upsertDailyReportSnapshot(
        currentUser,
        context.req.valid('json').snapshot,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'put',
      path: '/report-snapshots/bulk',
      request: { body: jsonRequest(upsertDailyReportSnapshotsBulkRequestSchema) },
      responses: apiResponses(dailyReportSnapshotsBulkResponseSchema),
      security: bearerSecurity,
      summary: '批量上传个人日报',
    }),
    async (context) => {
      const currentUser = context.get('currentUser');
      await requirePro(options.entitlementsService, currentUser);
      const body: DailyReportSnapshotsBulkResponse = await options.reportService.upsertDailyReportSnapshots(
        currentUser,
        context.req.valid('json').snapshots,
      );
      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}

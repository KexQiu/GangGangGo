import type {
  AdvancedReportResponse,
  DailyReportSnapshotResponse,
  DailyReportSnapshotsBulkResponse,
  TeamWeeklyReportResponse,
  UpsertDailyReportSnapshotRequest,
  UpsertDailyReportSnapshotsBulkRequest,
} from '@xiaotidu/contracts';
import {
  advancedReportResponseSchema,
  dailyReportSnapshotResponseSchema,
  dailyReportSnapshotsBulkResponseSchema,
  teamWeeklyReportResponseSchema,
} from '@xiaotidu/contracts';

import { request } from './core';

export const reportsApi = {
  getAdvancedReport: (token: string, signal?: AbortSignal) =>
    request<AdvancedReportResponse>('/reports/advanced?range=90d', advancedReportResponseSchema, { signal, token }),
  getTeamWeeklyReport: (token: string, signal?: AbortSignal) =>
    request<TeamWeeklyReportResponse>('/teams/current/reports/weekly', teamWeeklyReportResponseSchema, {
      signal,
      token,
    }),
  upsertReportSnapshot: (body: UpsertDailyReportSnapshotRequest, token: string) =>
    request<DailyReportSnapshotResponse>('/report-snapshots/today', dailyReportSnapshotResponseSchema, {
      body,
      method: 'PUT',
      token,
    }),
  upsertReportSnapshotsBulk: (body: UpsertDailyReportSnapshotsBulkRequest, token: string) =>
    request<DailyReportSnapshotsBulkResponse>('/report-snapshots/bulk', dailyReportSnapshotsBulkResponseSchema, {
      body,
      method: 'PUT',
      token,
    }),
};

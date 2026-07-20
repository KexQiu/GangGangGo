import { useQuery } from '@tanstack/react-query';

import { reportsApi } from '../../api/client';
import { useQueryErrorNotification } from '../../api/useQueryErrorNotification';
import { defaultProStatus, isProStatus } from '../account/accountModel';
import { useCurrentUserQuery, useEntitlementsQuery } from '../account/accountQueries';
import { useAuthStore } from '../account/authStore';
import { syncRecentReportSnapshots } from '../sync/reportSnapshotSync';
import { reportQueryKeys } from './reportQueryKeys';

type ReportQueryOptions = { enabled?: boolean };

export function useAdvancedReportQuery(options: ReportQueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const proStatus = useEntitlementsQuery().data?.proStatus ?? defaultProStatus;
  const userId = useCurrentUserQuery().data?.id;

  const query = useQuery({
    enabled: Boolean((options.enabled ?? true) && accessToken && userId && isProStatus(proStatus)),
    queryFn: async ({ signal }) => {
      await syncRecentReportSnapshots();
      return reportsApi.getAdvancedReport(requireValue(accessToken), signal);
    },
    queryKey: reportQueryKeys.advanced(userId ?? 'anonymous'),
    staleTime: 0,
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useTeamWeeklyReportQuery(options: ReportQueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const proStatus = useEntitlementsQuery().data?.proStatus ?? defaultProStatus;
  const userId = useCurrentUserQuery().data?.id;

  const query = useQuery({
    enabled: Boolean((options.enabled ?? true) && accessToken && userId && isProStatus(proStatus)),
    queryFn: ({ signal }) => reportsApi.getTeamWeeklyReport(requireValue(accessToken), signal),
    queryKey: reportQueryKeys.teamWeekly(userId ?? 'anonymous'),
  });
  useQueryErrorNotification(query.error);
  return query;
}

function requireValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined || value === '') throw new Error('请先登录。');
  return value;
}

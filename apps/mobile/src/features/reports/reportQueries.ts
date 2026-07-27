import { useQuery } from '@tanstack/react-query';

import { reportsApi } from '../../api/client';
import { useQueryErrorNotification } from '../../api/useQueryErrorNotification';
import { canAccessFeature } from '../account/accountModel';
import { useCurrentUserQuery, useEntitlementsQuery } from '../account/accountQueries';
import { useAuthStore } from '../account/authStore';
import { syncRecentReportSnapshots } from '../sync/reportSnapshotSync';
import { reportQueryKeys } from './reportQueryKeys';

type ReportQueryOptions = { enabled?: boolean };

export function useAdvancedReportQuery(options: ReportQueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const entitlements = useEntitlementsQuery().data;
  const userId = useCurrentUserQuery().data?.id;

  const query = useQuery({
    enabled: Boolean(
      (options.enabled ?? true) && accessToken && userId && canAccessFeature(entitlements, 'advancedReport'),
    ),
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

function requireValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined || value === '') throw new Error('请先登录。');
  return value;
}

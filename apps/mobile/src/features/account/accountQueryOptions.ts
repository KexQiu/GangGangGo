import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';

export function currentUserQueryOptions(accessToken: string) {
  return queryOptions({
    queryFn: ({ signal }) => apiClient.getCurrentUser(accessToken, signal),
    queryKey: queryKeys.currentUser,
  });
}

export function entitlementsQueryOptions(accessToken: string) {
  return queryOptions({
    queryFn: ({ signal }) => apiClient.getEntitlements(accessToken, signal),
    queryKey: queryKeys.entitlements,
  });
}

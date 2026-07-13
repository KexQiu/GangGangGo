import { queryOptions } from '@tanstack/react-query';

import { usersApi } from '../../api/client';
import { accountQueryKeys } from './accountQueryKeys';

export function currentUserQueryOptions(accessToken: string) {
  return queryOptions({
    queryFn: ({ signal }) => usersApi.getCurrentUser(accessToken, signal),
    queryKey: accountQueryKeys.currentUser,
  });
}

export function entitlementsQueryOptions(accessToken: string) {
  return queryOptions({
    queryFn: ({ signal }) => usersApi.getEntitlements(accessToken, signal),
    queryKey: accountQueryKeys.entitlements,
  });
}

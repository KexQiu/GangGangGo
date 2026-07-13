import type { QueryClient } from '@tanstack/react-query';

import type { UserProfile } from '@xiaotidu/contracts';

import { accountQueryKeys } from './accountQueryKeys';

export function clearCloudQueryCache(queryClient: QueryClient) {
  queryClient.clear();
}

export function setCurrentUserQueryData(queryClient: QueryClient, user: UserProfile) {
  queryClient.setQueryData(accountQueryKeys.currentUser, user);
}

export function resetCloudQueryCacheForUser(queryClient: QueryClient, user: UserProfile) {
  clearCloudQueryCache(queryClient);
  setCurrentUserQueryData(queryClient, user);
}

import type { QueryClient } from '@tanstack/react-query';

import type { UserProfile } from '@xiaotidu/contracts';

import { queryKeys } from '../../api/queryKeys';

export function clearCloudQueryCache(queryClient: QueryClient) {
  queryClient.clear();
}

export function setCurrentUserQueryData(queryClient: QueryClient, user: UserProfile) {
  queryClient.setQueryData(queryKeys.currentUser, user);
}

export function resetCloudQueryCacheForUser(queryClient: QueryClient, user: UserProfile) {
  clearCloudQueryCache(queryClient);
  setCurrentUserQueryData(queryClient, user);
}

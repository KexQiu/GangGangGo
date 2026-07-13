import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import type { BuddyNudgeThreadResponse } from '@xiaotidu/contracts';

import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';

export const nudgeThreadPageSize = 30;

export function nudgeThreadsQueryOptions(accessToken: string, userId: string) {
  return queryOptions({
    queryFn: ({ signal }) => apiClient.getNudgeThreads(accessToken, signal),
    queryKey: queryKeys.nudgeThreads(userId),
  });
}

export function nudgeThreadQueryOptions(accessToken: string, userId: string, buddyUserId: string) {
  return infiniteQueryOptions({
    getNextPageParam: (lastPage: BuddyNudgeThreadResponse) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }): Promise<BuddyNudgeThreadResponse> =>
      apiClient.getNudgeThread(buddyUserId, { before: pageParam, limit: nudgeThreadPageSize }, accessToken, signal),
    queryKey: queryKeys.nudgeThread(userId, buddyUserId),
  });
}

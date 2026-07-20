import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import type { BuddyNudgeThreadResponse } from '@xiaotidu/contracts';

import { nudgesApi } from '../../api/client';
import { nudgeQueryKeys } from './nudgeQueryKeys';

export const nudgeThreadPageSize = 30;

export function nudgeThreadsQueryOptions(accessToken: string, userId: string) {
  return queryOptions({
    queryFn: ({ signal }) => nudgesApi.getNudgeThreads(accessToken, signal),
    queryKey: nudgeQueryKeys.threads(userId),
  });
}

export function nudgeThreadQueryOptions(accessToken: string, userId: string, buddyUserId: string) {
  return infiniteQueryOptions({
    getNextPageParam: (lastPage: BuddyNudgeThreadResponse) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }): Promise<BuddyNudgeThreadResponse> =>
      nudgesApi.getNudgeThread(buddyUserId, { before: pageParam, limit: nudgeThreadPageSize }, accessToken, signal),
    queryKey: nudgeQueryKeys.thread(userId, buddyUserId),
  });
}

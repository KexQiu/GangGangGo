import { InfiniteQueryObserver, QueryClient, isCancelledError } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BuddyNudge, BuddyNudgeThreadResponse, NudgeThreadsResponse } from '@xiaotidu/contracts';

import { apiClient } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { getNudgeChatMessages } from '../nudgeModel';
import { cancelNudgeQueries } from '../nudgeQueryCache';
import { nudgeThreadQueryOptions, nudgeThreadsQueryOptions } from '../nudgeQueryOptions';

const currentUser = { avatarUrl: null, id: '00000000-0000-4000-8000-000000000001', nickname: '当前用户' };
const buddyUser = { avatarUrl: null, id: '00000000-0000-4000-8000-000000000002', nickname: '搭子' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('nudge query options', () => {
  it('aborts an unfinished request without touching another user cache', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let wasAborted = false;
    vi.spyOn(apiClient, 'getNudgeThreads').mockImplementation(
      (_token, signal) =>
        new Promise<NudgeThreadsResponse>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            wasAborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    queryClient.setQueryData(queryKeys.nudgeThreads('new-user'), { threads: [] });
    const request = queryClient.fetchQuery(nudgeThreadsQueryOptions('token', 'old-user')).catch((error) => error);
    await Promise.resolve();

    await cancelNudgeQueries(queryClient, 'old-user');

    expect(isCancelledError(await request)).toBe(true);
    expect(wasAborted).toBe(true);
    expect(queryClient.getQueryData(queryKeys.nudgeThreads('new-user'))).toEqual({ threads: [] });
  });

  it('uses the returned cursor and keeps paginated messages deduplicated and ordered', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const newMessage = createNudge('00000000-0000-4000-8000-000000000013', '2026-07-13T08:03:00.000Z');
    const newest = createNudge('00000000-0000-4000-8000-000000000011', '2026-07-13T08:02:00.000Z');
    const oldest = createNudge('00000000-0000-4000-8000-000000000012', '2026-07-13T08:00:00.000Z');
    let shouldReturnNewMessage = false;
    const getThread = vi.spyOn(apiClient, 'getNudgeThread').mockImplementation(async (_buddyId, options) => {
      if (options.before) return page([oldest, newest], false, null);
      return page(shouldReturnNewMessage ? [newMessage, newest] : [newest], true, '2026-07-13T08:01:00.000Z');
    });
    const options = nudgeThreadQueryOptions('token', currentUser.id, buddyUser.id);
    await queryClient.fetchInfiniteQuery(options);
    const observer = new InfiniteQueryObserver(queryClient, options);

    await observer.fetchNextPage();
    shouldReturnNewMessage = true;
    await observer.refetch();

    const pages = observer.getCurrentResult().data?.pages ?? [];
    const messages = getNudgeChatMessages({
      currentUserId: currentUser.id,
      nudges: pages.flatMap((item) => item.nudges),
    });
    expect(getThread.mock.calls.map((call) => call[1])).toEqual([
      { before: null, limit: 30 },
      { before: '2026-07-13T08:01:00.000Z', limit: 30 },
      { before: null, limit: 30 },
      { before: '2026-07-13T08:01:00.000Z', limit: 30 },
    ]);
    expect(messages.map((message) => message.id)).toEqual([oldest.id, newest.id, newMessage.id]);
  });
});

function page(nudges: BuddyNudge[], hasMore: boolean, nextCursor: null | string): BuddyNudgeThreadResponse {
  return { hasMore, nextCursor, nudges };
}

function createNudge(id: string, createdAt: string): BuddyNudge {
  return {
    ack: null,
    createdAt,
    expiresAt: '2026-07-14T08:00:00.000Z',
    fromUser: buddyUser,
    id,
    messageTemplate: '走两步',
    teamId: '00000000-0000-4000-8000-000000000003',
    toUser: currentUser,
    type: 'move',
  };
}

import type { QueryClient } from '@tanstack/react-query';

import { nudgeQueryKeys } from './nudgeQueryKeys';

export async function cancelNudgeQueries(queryClient: QueryClient, userId: string, buddyUserId?: string) {
  const cancellations = [queryClient.cancelQueries({ queryKey: nudgeQueryKeys.threads(userId) })];
  if (buddyUserId) {
    cancellations.push(queryClient.cancelQueries({ queryKey: nudgeQueryKeys.thread(userId, buddyUserId) }));
  }
  await Promise.all(cancellations);
}

export async function invalidateNudgeQueries(
  queryClient: QueryClient,
  userId: string | undefined,
  buddyUserId?: string,
) {
  if (!userId) return;
  const invalidations = [queryClient.invalidateQueries({ queryKey: nudgeQueryKeys.threads(userId) })];
  if (buddyUserId) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: nudgeQueryKeys.thread(userId, buddyUserId) }));
  }
  await Promise.all(invalidations);
}

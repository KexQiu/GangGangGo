import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../api/queryKeys';

export async function cancelNudgeQueries(queryClient: QueryClient, userId: string, buddyUserId?: string) {
  const cancellations = [queryClient.cancelQueries({ queryKey: queryKeys.nudgeThreads(userId) })];
  if (buddyUserId) {
    cancellations.push(queryClient.cancelQueries({ queryKey: queryKeys.nudgeThread(userId, buddyUserId) }));
  }
  await Promise.all(cancellations);
}

export async function invalidateNudgeQueries(
  queryClient: QueryClient,
  userId: string | undefined,
  buddyUserId?: string,
) {
  if (!userId) return;
  const invalidations = [queryClient.invalidateQueries({ queryKey: queryKeys.nudgeThreads(userId) })];
  if (buddyUserId) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: queryKeys.nudgeThread(userId, buddyUserId) }));
  }
  await Promise.all(invalidations);
}

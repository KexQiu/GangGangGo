import type { QueryClient } from '@tanstack/react-query';

import type { TeamResponse } from '@xiaotidu/contracts';

import { queryKeys } from '../../api/queryKeys';

export type TeamCacheUpdateOptions = {
  clearSnapshotsWhenTeamMissing?: boolean;
  invalidateSnapshots?: boolean;
};

export async function updateTeamQueryCache(
  queryClient: QueryClient,
  userId: string | undefined,
  response: TeamResponse,
  options: TeamCacheUpdateOptions = {},
) {
  if (!userId) return;
  queryClient.setQueryData(queryKeys.team(userId), response);
  if (!response.team && options.clearSnapshotsWhenTeamMissing) {
    queryClient.removeQueries({ queryKey: queryKeys.teamSnapshots(userId) });
  } else if (options.invalidateSnapshots) {
    await invalidateTeamSnapshots(queryClient, userId);
  }
}

export async function invalidateTeamSnapshots(queryClient: QueryClient, userId: string | undefined) {
  if (!userId) return;
  await queryClient.invalidateQueries({ queryKey: queryKeys.teamSnapshots(userId) });
}

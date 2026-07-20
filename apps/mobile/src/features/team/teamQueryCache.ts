import type { QueryClient } from '@tanstack/react-query';

import type { TeamResponse } from '@xiaotidu/contracts';

import { teamQueryKeys } from './teamQueryKeys';

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
  queryClient.setQueryData(teamQueryKeys.team(userId), response);
  if (!response.team && options.clearSnapshotsWhenTeamMissing) {
    queryClient.removeQueries({ queryKey: teamQueryKeys.teamSnapshots(userId) });
  } else if (options.invalidateSnapshots) {
    await invalidateTeamSnapshots(queryClient, userId);
  }
}

export async function invalidateTeamSnapshots(queryClient: QueryClient, userId: string | undefined) {
  if (!userId) return;
  await queryClient.invalidateQueries({ queryKey: teamQueryKeys.teamSnapshots(userId) });
}

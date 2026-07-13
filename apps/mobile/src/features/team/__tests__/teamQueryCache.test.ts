import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import type { TeamResponse, TeamSnapshotsResponse } from '@xiaotidu/contracts';

import { queryKeys } from '../../../api/queryKeys';
import { updateTeamQueryCache } from '../teamQueryCache';

const userId = '00000000-0000-4000-8000-000000000001';

describe('team query cache', () => {
  it('updates the team and invalidates snapshots after a member mutation', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<TeamSnapshotsResponse>(queryKeys.teamSnapshots(userId), {
      date: '2026-07-13',
      snapshots: [],
    });
    const response = createTeamResponse();

    await updateTeamQueryCache(queryClient, userId, response, { invalidateSnapshots: true });

    expect(queryClient.getQueryData(queryKeys.team(userId))).toEqual(response);
    expect(queryClient.getQueryState(queryKeys.teamSnapshots(userId))?.isInvalidated).toBe(true);
  });

  it('removes snapshots after leaving the team', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<TeamSnapshotsResponse>(queryKeys.teamSnapshots(userId), {
      date: '2026-07-13',
      snapshots: [],
    });

    await updateTeamQueryCache(queryClient, userId, { team: null }, { clearSnapshotsWhenTeamMissing: true });

    expect(queryClient.getQueryData(queryKeys.team(userId))).toEqual({ team: null });
    expect(queryClient.getQueryData(queryKeys.teamSnapshots(userId))).toBeUndefined();
  });
});

function createTeamResponse(): TeamResponse {
  return {
    team: {
      id: '00000000-0000-4000-8000-000000000002',
      members: [],
      name: '小提督小队',
      ownerUserId: userId,
    },
  };
}

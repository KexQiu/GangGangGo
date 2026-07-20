import type { TeamResponse } from '@xiaotidu/contracts';

import { ApiClientError } from '../../api/transport';

export async function getCurrentTeamOrEmpty(fetchCurrentTeam: () => Promise<TeamResponse>): Promise<TeamResponse> {
  try {
    return await fetchCurrentTeam();
  } catch (error) {
    if (isMissingCurrentTeamError(error)) return { team: null };
    throw error;
  }
}

function isMissingCurrentTeamError(error: unknown) {
  return error instanceof ApiClientError && error.status === 404;
}

import { describe, expect, it } from 'vitest';

import { ApiClientError } from '../../../api/transport';
import { getCurrentTeamOrEmpty } from '../currentTeamQueryResult';

describe('current team query result', () => {
  it('treats a missing current team as an empty team result', async () => {
    const fetchCurrentTeam = () => Promise.reject(new ApiClientError(404, 'not_found', '还没有小队。'));

    await expect(getCurrentTeamOrEmpty(fetchCurrentTeam)).resolves.toEqual({ team: null });
  });

  it('keeps other request failures as errors', async () => {
    const error = new ApiClientError(500, 'internal_error', '服务暂时不可用。');
    const fetchCurrentTeam = () => Promise.reject(error);

    await expect(getCurrentTeamOrEmpty(fetchCurrentTeam)).rejects.toBe(error);
  });
});

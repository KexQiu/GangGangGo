import { describe, expect, it, vi } from 'vitest';

import type { BuddyNudgeSettings } from '@xiaotidu/contracts';

import type { CurrentUser } from '../users/userTypes.js';
import type { NudgeRepository, NudgeRepositoryQueries } from './nudge.repository.js';
import { createNudgeService } from './nudgeService.js';

const currentUser: CurrentUser = {
  appleUserId: 'nudge-service-user',
  avatarUrl: null,
  id: 'user-1',
  nickname: '甲',
  timezone: 'Asia/Shanghai',
};

const team = { id: 'team-1', name: '测试队', ownerUserId: currentUser.id };
const members: Awaited<ReturnType<NudgeRepository['listTeamMembers']>> = [
  { role: 'owner', status: 'active', user: { avatarUrl: null, id: currentUser.id, nickname: '甲' } },
  { role: 'buddy', status: 'active', user: { avatarUrl: null, id: 'user-2', nickname: '乙' } },
  { role: 'buddy', status: 'active', user: { avatarUrl: null, id: 'user-3', nickname: '丙' } },
];

function settings(buddyUserId: string, dailyLimit: BuddyNudgeSettings['dailyLimit'] = 5): BuddyNudgeSettings {
  return {
    buddyUserId,
    dailyLimit,
    enabled: true,
    quietRanges: [],
    teamId: team.id,
    userId: currentUser.id,
  };
}

function createRepository(overrides: Partial<NudgeRepositoryQueries> = {}): NudgeRepository {
  const queries: NudgeRepositoryQueries = {
    createAck: vi.fn(async () => null),
    createNudge: vi.fn(async (input) => ({
      id: 'nudge-1',
      messageTemplate: input.messageTemplate,
      teamId: input.teamId,
      toUserId: input.toUserId,
      type: input.type,
    })),
    findAck: vi.fn(async () => null),
    findCurrentTeam: vi.fn(async () => team),
    findNudge: vi.fn(async () => null),
    findSettings: vi.fn(async () => null),
    findUserTimezone: vi.fn(async () => 'Asia/Shanghai'),
    incrementDailyCounter: vi.fn(async () => 1),
    listNudgesByUser: vi.fn(async () => []),
    listSettings: vi.fn(async () => []),
    listTeamMembers: vi.fn(async () => members),
    listTeamNudges: vi.fn(async () => []),
    listThreadNudges: vi.fn(async () => []),
    reviseAck: vi.fn(async () => null),
    upsertSettings: vi.fn(async (_teamId, _userId, buddyUserId, input) => ({
      ...input,
      buddyUserId,
      teamId: team.id,
      userId: currentUser.id,
    })),
    ...overrides,
  };

  return {
    ...queries,
    withTransaction: (work) => work(queries),
  };
}

describe('nudge service', () => {
  it('loads all buddy settings with one repository query', async () => {
    const repository = createRepository({
      listSettings: vi.fn(async () => [settings('user-2', 3)]),
    });
    const service = createNudgeService(repository);

    const response = await service.getSettings(currentUser);

    expect(response.settings).toEqual([settings('user-2', 3), settings('user-3')]);
    expect(repository.listSettings).toHaveBeenCalledTimes(1);
    expect(repository.findSettings).not.toHaveBeenCalled();
  });

  it('rolls back before creating a nudge when the atomic counter exceeds the limit', async () => {
    const createNudge = vi.fn<NudgeRepositoryQueries['createNudge']>();
    const repository = createRepository({
      createNudge,
      findSettings: vi.fn(async () => ({ ...settings(currentUser.id, 3), userId: 'user-2' })),
      incrementDailyCounter: vi.fn(async () => 4),
    });
    const service = createNudgeService(repository);

    await expect(service.createNudge(currentUser, { toUserId: 'user-2', type: 'gentle' })).rejects.toMatchObject({
      code: 'rate_limited',
      statusCode: 429,
    });
    expect(repository.incrementDailyCounter).toHaveBeenCalledTimes(1);
    expect(createNudge).not.toHaveBeenCalled();
    expect(repository.findNudge).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';

import type { CurrentUser } from '../users/userTypes.js';
import { ensureCanCreateTeam, ensureCanInvite, ensureCanJoinTeam, ensureTeamCapacity } from './team.policy.js';
import type { TeamRecord } from './team.types.js';

const owner: CurrentUser = {
  appleUserId: 'team-policy-owner',
  avatarUrl: null,
  id: 'owner-1',
  nickname: '队长',
  timezone: 'Asia/Shanghai',
};

const team: TeamRecord = {
  archivedAt: null,
  id: 'team-1',
  name: '测试队',
  ownerUserId: owner.id,
};

describe('team policy', () => {
  it('rejects creating or joining a second current team', () => {
    expect(() => ensureCanCreateTeam(true)).toThrowError('你已经有一个小队了。');
    expect(() => ensureCanJoinTeam(true)).toThrowError('你已经在一个小队里了。');
    expect(() => ensureCanCreateTeam(false)).not.toThrow();
    expect(() => ensureCanJoinTeam(false)).not.toThrow();
  });

  it('enforces the four-member capacity boundary', () => {
    expect(() => ensureTeamCapacity(3)).not.toThrow();
    expect(() => ensureTeamCapacity(4)).toThrowError('小队已经满员了。');
    expect(() => ensureTeamCapacity(5)).toThrowError('小队已经满员了。');
  });

  it('requires the owner and available capacity before inviting', () => {
    expect(() => ensureCanInvite(owner, team, 3)).not.toThrow();
    expect(() => ensureCanInvite({ ...owner, id: 'buddy-1' }, team, 3)).toThrowError('只有小队创建者可以邀请搭子。');
    expect(() => ensureCanInvite(owner, team, 4)).toThrowError('小队已经满员了。');
  });
});

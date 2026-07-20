import { createHash, randomBytes } from 'node:crypto';

import type { Team } from '@xiaotidu/contracts';

import { ApiError } from '../../http/apiError.js';
import type { CurrentUser } from '../users/userTypes.js';
import type { TeamRecord } from './team.types.js';

export function normalizeTeamName(name: string | undefined) {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 40) : '我的小队';
}

export function requireTeam(team: Team | null): Team {
  if (!team) {
    throw new ApiError(404, 'not_found', '还没有小队。');
  }

  return team;
}

export function createInviteToken() {
  return randomBytes(24).toString('base64url');
}

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createInviteUrl(token: string) {
  return `xiaotidu://team/join/${token}`;
}

export function createInviteExpiration(now = new Date()) {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function ensureInviteIsUsable(invite: { acceptedAt: Date | null; expiresAt: Date; revokedAt: Date | null }) {
  if (invite.revokedAt) {
    throw new ApiError(404, 'not_found', '这个邀请已经失效。');
  }

  if (invite.acceptedAt) {
    throw new ApiError(409, 'conflict', '这个邀请已经被使用过了。');
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(404, 'not_found', '这个邀请已经过期。');
  }
}

export function ensureCanInvite(currentUser: CurrentUser, team: TeamRecord, memberCount: number) {
  ensureOwner(currentUser, team, '只有小队创建者可以邀请搭子。');
  ensureTeamCapacity(memberCount);
}

export function ensureTeamCapacity(memberCount: number) {
  if (memberCount >= 4) {
    throw new ApiError(409, 'conflict', '小队已经满员了。');
  }
}

export function ensureCanCreateTeam(hasCurrentMembership: boolean) {
  if (hasCurrentMembership) {
    throw new ApiError(409, 'conflict', '你已经有一个小队了。');
  }
}

export function ensureCanJoinTeam(hasCurrentMembership: boolean) {
  if (hasCurrentMembership) {
    throw new ApiError(409, 'conflict', '你已经在一个小队里了。');
  }
}

export function ensureOwner(currentUser: CurrentUser, team: TeamRecord, message = '只有小队创建者可以操作。') {
  if (team.ownerUserId !== currentUser.id) {
    throw new ApiError(403, 'forbidden', message);
  }
}

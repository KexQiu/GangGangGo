import type { DailyShareSnapshot, ShareSettings } from '@xiaotidu/contracts';

import { ApiError } from '../../http/apiError.js';
import type { CurrentUser } from '../users/userTypes.js';
import { applyShareSettings, defaultShareSettings, normalizeShareSettings, toTeam } from './team.mapper.js';
import {
  createInviteExpiration,
  createInviteToken,
  createInviteUrl,
  ensureCanInvite,
  ensureInviteIsUsable,
  ensureOwner,
  normalizeTeamName,
  requireTeam,
} from './team.policy.js';
import type { TeamService } from './teamService.js';
import type { MemberRecord, TeamRecord } from './team.types.js';

export function createMockTeamService(): TeamService {
  let team: TeamRecord | null = null;
  let members: MemberRecord[] = [];
  const invitesByToken = new Map<
    string,
    {
      acceptedAt: Date | null;
      expiresAt: Date;
      id: string;
      inviterUserId: string;
      revokedAt: Date | null;
      teamId: string;
    }
  >();
  const settingsByUserId = new Map<string, ShareSettings>();
  const snapshotsByUserAndDate = new Map<string, DailyShareSnapshot>();

  function currentTeamResponse(currentUser?: CurrentUser) {
    if (currentUser && !members.some((member) => member.user.id === currentUser.id && member.status !== 'removed')) {
      return { team: null };
    }

    return {
      team: team
        ? toTeam(
            team,
            members.filter((member) => member.status !== 'removed'),
          )
        : null,
    };
  }

  function ensureCurrentTeam(currentUser?: CurrentUser) {
    return requireTeam(currentTeamResponse(currentUser).team);
  }

  function findCurrentMember(currentUser: CurrentUser) {
    const member = members.find((item) => item.user.id === currentUser.id && item.status !== 'removed');

    if (!member) {
      throw new ApiError(404, 'not_found', '还没有小队。');
    }

    return member;
  }

  return {
    async acceptInvite(currentUser, token, input) {
      const invite = invitesByToken.get(token);

      if (!invite || !team || invite.teamId !== team.id) {
        throw new ApiError(404, 'not_found', '没有找到这个邀请。');
      }

      ensureInviteIsUsable(invite);

      if (members.some((member) => member.user.id === currentUser.id && member.status !== 'removed')) {
        throw new ApiError(409, 'conflict', '你已经在这个小队里了。');
      }

      if (members.filter((member) => member.status !== 'removed').length >= 4) {
        throw new ApiError(409, 'conflict', '小队已经满员了。');
      }

      invite.acceptedAt = new Date();
      members.push({
        displayName: input.displayName ?? currentUser.nickname,
        id: `00000000-0000-4000-8000-${String(200 + members.length + 1).padStart(12, '0')}`,
        joinedAt: new Date('2026-05-22T00:00:00.000Z'),
        role: 'buddy',
        status: 'active',
        user: {
          avatarUrl: currentUser.avatarUrl,
          id: currentUser.id,
          nickname: currentUser.nickname,
        },
      });
      settingsByUserId.set(currentUser.id, normalizeShareSettings(input.shareSettings));

      return currentTeamResponse(currentUser);
    },
    async createInvite(currentUser) {
      const currentTeam = ensureCurrentTeam(currentUser);

      if (!team) {
        throw new ApiError(404, 'not_found', '还没有小队。');
      }

      ensureCanInvite(currentUser, team, currentTeam.members.length);

      const token = createInviteToken();
      const invite = {
        acceptedAt: null,
        expiresAt: createInviteExpiration(),
        id: `00000000-0000-4000-8000-${String(invitesByToken.size + 301).padStart(12, '0')}`,
        inviterUserId: currentUser.id,
        revokedAt: null,
        teamId: currentTeam.id,
      };

      invitesByToken.set(token, invite);

      return {
        expiresAt: invite.expiresAt.toISOString(),
        inviteId: invite.id,
        inviteUrl: createInviteUrl(token),
        token,
      };
    },
    async createTeam(currentUser, input) {
      if (team && team.archivedAt === null) {
        throw new ApiError(409, 'conflict', '你已经有一个小队了。');
      }

      team = {
        archivedAt: null,
        id: '00000000-0000-4000-8000-000000000101',
        name: normalizeTeamName(input.name),
        ownerUserId: currentUser.id,
      };
      members = [
        {
          displayName: currentUser.nickname,
          id: '00000000-0000-4000-8000-000000000201',
          joinedAt: new Date('2026-05-22T00:00:00.000Z'),
          role: 'owner',
          status: 'active',
          user: {
            avatarUrl: currentUser.avatarUrl,
            id: currentUser.id,
            nickname: currentUser.nickname,
          },
        },
      ];
      settingsByUserId.set(currentUser.id, defaultShareSettings);

      return currentTeamResponse(currentUser);
    },
    async getCurrentTeam(currentUser) {
      return currentTeamResponse(currentUser);
    },
    async getCurrentTeamSnapshots(_currentUser, date) {
      const currentTeam = ensureCurrentTeam(_currentUser);

      return {
        date,
        snapshots: currentTeam.members.map((member) => {
          const settings = settingsByUserId.get(member.user.id) ?? defaultShareSettings;
          const snapshot = snapshotsByUserAndDate.get(`${member.user.id}:${date}`) ?? null;

          return {
            member,
            shareSettings: settings,
            snapshot: member.status === 'paused' ? null : applyShareSettings(snapshot, settings),
          };
        }),
      };
    },
    async leaveTeam(currentUser) {
      if (!team) {
        throw new ApiError(404, 'not_found', '还没有小队。');
      }

      const currentMember = findCurrentMember(currentUser);

      if (currentMember.role === 'owner') {
        team.archivedAt = new Date();
        members = members.map((member) => ({
          ...member,
          status: 'removed',
        }));
      } else {
        currentMember.status = 'removed';
      }

      settingsByUserId.set(currentUser.id, {
        ...(settingsByUserId.get(currentUser.id) ?? defaultShareSettings),
        paused: true,
      });

      return currentTeamResponse(currentUser);
    },
    async previewInvite(token) {
      const invite = invitesByToken.get(token);

      if (!invite || !team || invite.teamId !== team.id) {
        throw new ApiError(404, 'not_found', '没有找到这个邀请。');
      }

      ensureInviteIsUsable(invite);

      const inviter = members.find((member) => member.user.id === invite.inviterUserId);

      return {
        expiresAt: invite.expiresAt.toISOString(),
        inviterNickname: inviter?.user.nickname ?? null,
        teamName: team.name,
      };
    },
    async removeMember(currentUser, memberId) {
      if (!team) {
        throw new ApiError(404, 'not_found', '还没有小队。');
      }

      ensureOwner(currentUser, team);

      const member = members.find((item) => item.id === memberId && item.status !== 'removed');

      if (!member) {
        throw new ApiError(404, 'not_found', '没有找到这个成员。');
      }

      if (member.role === 'owner' || member.user.id === currentUser.id) {
        throw new ApiError(400, 'bad_request', '不能移除小队创建者。');
      }

      member.status = 'removed';
      settingsByUserId.set(member.user.id, {
        ...(settingsByUserId.get(member.user.id) ?? defaultShareSettings),
        paused: true,
      });

      return currentTeamResponse(currentUser);
    },
    async setCurrentMemberStatus(currentUser, status) {
      const member = findCurrentMember(currentUser);

      member.status = status;
      settingsByUserId.set(currentUser.id, {
        ...(settingsByUserId.get(currentUser.id) ?? defaultShareSettings),
        paused: status === 'paused',
      });

      return currentTeamResponse(currentUser);
    },
    async updateShareSettings(currentUser, input) {
      ensureCurrentTeam(currentUser);
      settingsByUserId.set(currentUser.id, input);

      return {
        settings: input,
      };
    },
    async updateTeam(currentUser, input) {
      if (!team) {
        throw new ApiError(404, 'not_found', '还没有小队。');
      }

      ensureOwner(currentUser, team);
      team.name = normalizeTeamName(input.name);

      return currentTeamResponse(currentUser);
    },
    async upsertDailyShareSnapshot(currentUser, snapshot) {
      ensureCurrentTeam(currentUser);
      snapshotsByUserAndDate.set(`${currentUser.id}:${snapshot.date}`, snapshot);

      return { snapshot };
    },
  };
}

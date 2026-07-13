import type {
  AcceptTeamInviteRequest,
  AcceptTeamInviteResponse,
  CreateTeamRequest,
  CreateTeamInviteResponse,
  DailyShareSnapshot,
  DailyShareSnapshotResponse,
  ShareSettingsResponse,
  TeamInvitePreviewResponse,
  TeamMemberStatus,
  TeamResponse,
  TeamSnapshotsResponse,
  UpdateShareSettingsRequest,
  UpdateTeamRequest,
} from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import { ApiError } from '../../http/apiError.js';
import type { CurrentUser } from '../users/userTypes.js';
import {
  applyShareSettings,
  defaultShareSettings,
  normalizeShareSettings,
  toTeam,
  toTeamMember,
} from './team.mapper.js';
import {
  createInviteExpiration,
  createInviteToken,
  createInviteUrl,
  ensureCanCreateTeam,
  ensureCanInvite,
  ensureCanJoinTeam,
  ensureInviteIsUsable,
  ensureOwner,
  ensureTeamCapacity,
  hashInviteToken,
  normalizeTeamName,
} from './team.policy.js';
import { createDrizzleTeamRepository, type TeamRepository } from './team.repository.js';
import type { MemberRecord } from './team.types.js';

export type TeamService = {
  acceptInvite: (
    currentUser: CurrentUser,
    token: string,
    input: AcceptTeamInviteRequest,
  ) => Promise<AcceptTeamInviteResponse>;
  createInvite: (currentUser: CurrentUser) => Promise<CreateTeamInviteResponse>;
  createTeam: (currentUser: CurrentUser, input: CreateTeamRequest) => Promise<TeamResponse>;
  getCurrentTeam: (currentUser: CurrentUser) => Promise<TeamResponse>;
  getCurrentTeamSnapshots: (currentUser: CurrentUser, date: string) => Promise<TeamSnapshotsResponse>;
  leaveTeam: (currentUser: CurrentUser) => Promise<TeamResponse>;
  previewInvite: (token: string) => Promise<TeamInvitePreviewResponse>;
  removeMember: (currentUser: CurrentUser, memberId: string) => Promise<TeamResponse>;
  setCurrentMemberStatus: (
    currentUser: CurrentUser,
    status: Extract<TeamMemberStatus, 'active' | 'paused'>,
  ) => Promise<TeamResponse>;
  updateShareSettings: (currentUser: CurrentUser, input: UpdateShareSettingsRequest) => Promise<ShareSettingsResponse>;
  updateTeam: (currentUser: CurrentUser, input: UpdateTeamRequest) => Promise<TeamResponse>;
  upsertDailyShareSnapshot: (
    currentUser: CurrentUser,
    snapshot: DailyShareSnapshot,
  ) => Promise<DailyShareSnapshotResponse>;
};

export { createMockTeamService } from './team.mock.js';

export function createTeamService(repository: TeamRepository): TeamService {
  async function getRequiredTeam(currentUser: CurrentUser) {
    const teamRecord = await repository.findCurrentTeam(currentUser.id);

    if (!teamRecord) {
      throw new ApiError(404, 'not_found', '还没有小队。');
    }

    return {
      members: await repository.listMembers(teamRecord.id),
      teamRecord,
    };
  }

  function requireMember(members: MemberRecord[], currentUser: CurrentUser) {
    const member = members.find((item) => item.user.id === currentUser.id);

    if (!member) {
      throw new ApiError(404, 'not_found', '还没有小队。');
    }

    return member;
  }

  async function findUsableInviteByToken(token: string) {
    const invite = await repository.findInviteByTokenHash(hashInviteToken(token));

    if (!invite) {
      throw new ApiError(404, 'not_found', '没有找到这个邀请。');
    }

    ensureInviteIsUsable(invite);
    return invite;
  }

  async function getCurrentTeam(currentUser: CurrentUser): Promise<TeamResponse> {
    const teamRecord = await repository.findCurrentTeam(currentUser.id);

    if (!teamRecord) {
      return { team: null };
    }

    return {
      team: toTeam(teamRecord, await repository.listMembers(teamRecord.id)),
    };
  }

  return {
    async acceptInvite(currentUser, token, input) {
      const invite = await findUsableInviteByToken(token);
      ensureCanJoinTeam(Boolean(await repository.findCurrentTeam(currentUser.id)));

      await repository.withTransaction(async (transaction) => {
        const now = new Date();
        await transaction.lockUser(currentUser.id);
        await transaction.lockTeam(invite.teamId);
        ensureCanJoinTeam(Boolean(await transaction.findCurrentMembershipId(currentUser.id)));
        ensureTeamCapacity(await transaction.countCurrentMembers(invite.teamId));

        if (!(await transaction.acceptInvite(invite.id, currentUser.id, now))) {
          throw new ApiError(409, 'conflict', '这个邀请已经不能使用了。');
        }

        await transaction.insertMember({
          displayName: input.displayName ?? currentUser.nickname,
          role: 'buddy',
          teamId: invite.teamId,
          userId: currentUser.id,
        });
        await transaction.insertShareSettings(
          invite.teamId,
          currentUser.id,
          normalizeShareSettings(input.shareSettings),
        );
      });

      return getCurrentTeam(currentUser);
    },
    async createInvite(currentUser) {
      const { members, teamRecord } = await getRequiredTeam(currentUser);
      ensureCanInvite(currentUser, teamRecord, members.length);
      const token = createInviteToken();
      const invite = await repository.createInvite({
        expiresAt: createInviteExpiration(),
        inviterUserId: currentUser.id,
        teamId: teamRecord.id,
        tokenHash: hashInviteToken(token),
      });

      return {
        expiresAt: invite.expiresAt.toISOString(),
        inviteId: invite.id,
        inviteUrl: createInviteUrl(token),
        token,
      };
    },
    async createTeam(currentUser, input) {
      ensureCanCreateTeam(Boolean(await repository.findCurrentTeam(currentUser.id)));
      const teamName = normalizeTeamName(input.name);

      await repository.withTransaction(async (transaction) => {
        await transaction.lockUser(currentUser.id);
        ensureCanCreateTeam(Boolean(await transaction.findCurrentMembershipId(currentUser.id)));
        const createdTeam = await transaction.createTeam(currentUser.id, teamName);
        await transaction.insertMember({
          displayName: currentUser.nickname,
          role: 'owner',
          teamId: createdTeam.id,
          userId: currentUser.id,
        });
        await transaction.insertShareSettings(createdTeam.id, currentUser.id);
      });

      return getCurrentTeam(currentUser);
    },
    getCurrentTeam,
    async getCurrentTeamSnapshots(currentUser, date) {
      const { members, teamRecord } = await getRequiredTeam(currentUser);
      const memberUserIds = members.map((member) => member.user.id);
      const [settingsRows, snapshotRows] = await Promise.all([
        repository.listShareSettings(teamRecord.id),
        repository.listDailyShareSnapshots(date, memberUserIds),
      ]);
      const settingsByUserId = new Map(settingsRows.map((row) => [row.userId, row.settings]));
      const snapshotsByUserId = new Map(snapshotRows.map((row) => [row.userId, row.snapshot]));

      return {
        date,
        snapshots: members.map((member) => {
          const settings = settingsByUserId.get(member.user.id) ?? defaultShareSettings;
          const snapshot = snapshotsByUserId.get(member.user.id) ?? null;

          return {
            member: toTeamMember(member),
            shareSettings: settings,
            snapshot: member.status === 'paused' ? null : applyShareSettings(snapshot, settings),
          };
        }),
      };
    },
    async leaveTeam(currentUser) {
      const { members, teamRecord } = await getRequiredTeam(currentUser);
      const currentMember = requireMember(members, currentUser);
      const now = new Date();

      await repository.withTransaction(async (transaction) => {
        if (currentMember.role === 'owner') {
          await transaction.archiveTeam(teamRecord.id, now);
          await transaction.removeAllMembers(teamRecord.id, now);
        } else {
          await transaction.removeMember(currentMember.id, now);
        }

        await transaction.pauseShareSettings(teamRecord.id, currentUser.id, now);
      });

      return getCurrentTeam(currentUser);
    },
    async previewInvite(token) {
      const invite = await findUsableInviteByToken(token);
      return {
        expiresAt: invite.expiresAt.toISOString(),
        inviterNickname: invite.inviterNickname,
        teamName: invite.teamName,
      };
    },
    async removeMember(currentUser, memberId) {
      const { members, teamRecord } = await getRequiredTeam(currentUser);
      ensureOwner(currentUser, teamRecord);
      const member = members.find((item) => item.id === memberId);

      if (!member) {
        throw new ApiError(404, 'not_found', '没有找到这个成员。');
      }

      if (member.role === 'owner' || member.user.id === currentUser.id) {
        throw new ApiError(400, 'bad_request', '不能移除小队创建者。');
      }

      const now = new Date();
      await repository.withTransaction(async (transaction) => {
        await transaction.removeMember(member.id, now);
        await transaction.pauseShareSettings(teamRecord.id, member.user.id, now);
      });

      return getCurrentTeam(currentUser);
    },
    async setCurrentMemberStatus(currentUser, status) {
      const { members, teamRecord } = await getRequiredTeam(currentUser);
      const currentMember = requireMember(members, currentUser);
      const now = new Date();
      await repository.withTransaction(async (transaction) => {
        await transaction.setMemberStatus(currentMember.id, status, now);
        await transaction.upsertMemberSharePause(teamRecord.id, currentUser.id, status === 'paused', now);
      });

      return getCurrentTeam(currentUser);
    },
    async updateShareSettings(currentUser, input) {
      const { teamRecord } = await getRequiredTeam(currentUser);
      return {
        settings: await repository.upsertShareSettings(teamRecord.id, currentUser.id, input),
      };
    },
    async updateTeam(currentUser, input) {
      const { teamRecord } = await getRequiredTeam(currentUser);
      ensureOwner(currentUser, teamRecord);
      await repository.updateTeamName(teamRecord.id, normalizeTeamName(input.name), new Date());
      return getCurrentTeam(currentUser);
    },
    async upsertDailyShareSnapshot(currentUser, snapshot) {
      await getRequiredTeam(currentUser);
      return {
        snapshot: await repository.upsertDailyShareSnapshot(currentUser.id, snapshot),
      };
    },
  };
}

export function createDrizzleTeamService(db: Database): TeamService {
  return createTeamService(createDrizzleTeamRepository(db));
}

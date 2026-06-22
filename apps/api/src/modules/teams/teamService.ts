import { and, eq, gt, inArray, isNull, ne } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';

import type {
  AcceptTeamInviteRequest,
  AcceptTeamInviteResponse,
  CreateTeamRequest,
  CreateTeamInviteResponse,
  DailyShareSnapshot,
  DailyShareSnapshotResponse,
  ShareSettings,
  ShareSettingsResponse,
  Team,
  TeamDailyShareSnapshot,
  TeamInvitePreviewResponse,
  TeamMember,
  TeamMemberStatus,
  TeamResponse,
  TeamSnapshotsResponse,
  UpdateShareSettingsRequest,
  UpdateTeamRequest,
} from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import {
  dailyShareSnapshots,
  shareSettings,
  teamInvites,
  teamMembers,
  teams,
  users,
} from '../../db/schema.js';
import { ApiError } from '../../http/apiError.js';
import { deserializeAvatarConfig } from '../users/avatarConfig.js';
import type { CurrentUser } from '../users/userTypes.js';

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
  updateShareSettings: (
    currentUser: CurrentUser,
    input: UpdateShareSettingsRequest,
  ) => Promise<ShareSettingsResponse>;
  updateTeam: (currentUser: CurrentUser, input: UpdateTeamRequest) => Promise<TeamResponse>;
  upsertDailyShareSnapshot: (
    currentUser: CurrentUser,
    snapshot: DailyShareSnapshot,
  ) => Promise<DailyShareSnapshotResponse>;
};

type TeamRecord = {
  archivedAt: Date | null;
  id: string;
  name: string;
  ownerUserId: string;
};

type MemberRecord = {
  displayName: null | string;
  id: string;
  joinedAt: Date | string;
  role: 'buddy' | 'owner';
  status: 'active' | 'paused' | 'removed';
  user: TeamMember['user'];
};

const defaultShareSettings: ShareSettings = {
  paused: false,
  shareHabitCompletion: true,
  shareStreak: true,
  shareToiletRecorded: true,
  shareTraining: true,
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function toTeam(team: TeamRecord, members: MemberRecord[]): Team {
  return {
    id: team.id,
    members: members.map(toTeamMember),
    name: team.name,
    ownerUserId: team.ownerUserId,
  };
}

function toTeamMember(member: MemberRecord): TeamMember {
  return {
    displayName: member.displayName,
    id: member.id,
    joinedAt: toIsoString(member.joinedAt),
    role: member.role,
    status: member.status,
    user: member.user,
  };
}

function normalizeTeamName(name: string | undefined) {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 40) : '我的小队';
}

function requireTeam(team: Team | null): Team {
  if (!team) {
    throw new ApiError(404, 'not_found', '还没有小队。');
  }

  return team;
}

function createInviteToken() {
  return randomBytes(24).toString('base64url');
}

function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createInviteUrl(token: string) {
  return `xiaotidu://team/join/${token}`;
}

function createInviteExpiration(now = new Date()) {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}

function ensureInviteIsUsable(invite: {
  acceptedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
}) {
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

function ensureCanInvite(currentUser: CurrentUser, team: TeamRecord, memberCount: number) {
  if (team.ownerUserId !== currentUser.id) {
    throw new ApiError(403, 'forbidden', '只有小队创建者可以邀请搭子。');
  }

  if (memberCount >= 4) {
    throw new ApiError(409, 'conflict', '小队已经满员了。');
  }
}

function ensureOwner(currentUser: CurrentUser, team: TeamRecord) {
  if (team.ownerUserId !== currentUser.id) {
    throw new ApiError(403, 'forbidden', '只有小队创建者可以操作。');
  }
}

function normalizeShareSettings(input?: Partial<ShareSettings>): ShareSettings {
  return {
    ...defaultShareSettings,
    ...input,
  };
}

function applyShareSettings(
  snapshot: DailyShareSnapshot | null,
  settings: ShareSettings,
): TeamDailyShareSnapshot | null {
  if (!snapshot || settings.paused) {
    return null;
  }

  return {
    date: snapshot.date,
    ...(settings.shareTraining ? { trainingDone: snapshot.trainingDone } : {}),
    ...(settings.shareHabitCompletion ? { habitCompletion: snapshot.habitCompletion } : {}),
    ...(settings.shareToiletRecorded ? { toiletRecorded: snapshot.toiletRecorded } : {}),
    ...(settings.shareStreak ? { streakDays: snapshot.streakDays } : {}),
  };
}

function toShareSettings(record: typeof shareSettings.$inferSelect): ShareSettings {
  return {
    paused: record.paused,
    shareHabitCompletion: record.shareHabitCompletion,
    shareStreak: record.shareStreak,
    shareToiletRecorded: record.shareToiletRecorded,
    shareTraining: record.shareTraining,
  };
}

function toDailyShareSnapshot(record: typeof dailyShareSnapshots.$inferSelect): DailyShareSnapshot {
  return {
    date: record.date,
    habitCompletion: record.habitCompletion as DailyShareSnapshot['habitCompletion'],
    streakDays: record.streakDays,
    toiletRecorded: record.toiletRecorded,
    trainingDone: record.trainingDone,
  };
}

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

  function currentTeamResponse(currentUser?: CurrentUser): TeamResponse {
    if (
      currentUser &&
      !members.some((member) => member.user.id === currentUser.id && member.status !== 'removed')
    ) {
      return { team: null };
    }

    return {
      team: team ? toTeam(team, members.filter((member) => member.status !== 'removed')) : null,
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

export function createDrizzleTeamService(db: Database): TeamService {
  async function findCurrentTeamRecord(currentUser: CurrentUser) {
    const [row] = await db
      .select({
        archivedAt: teams.archivedAt,
        id: teams.id,
        name: teams.name,
        ownerUserId: teams.ownerUserId,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(
        and(
          eq(teamMembers.userId, currentUser.id),
          ne(teamMembers.status, 'removed'),
          isNull(teams.archivedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async function listMembers(teamId: string): Promise<MemberRecord[]> {
    const rows = await db
      .select({
        avatarUrl: users.avatarUrl,
        displayName: teamMembers.displayName,
        id: teamMembers.id,
        joinedAt: teamMembers.joinedAt,
        nickname: users.nickname,
        role: teamMembers.role,
        status: teamMembers.status,
        userId: users.id,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(and(eq(teamMembers.teamId, teamId), ne(teamMembers.status, 'removed'), isNull(users.deletedAt)));

    return rows.map((row) => ({
      displayName: row.displayName,
      id: row.id,
      joinedAt: row.joinedAt,
      role: row.role,
      status: row.status,
      user: {
        avatarUrl: deserializeAvatarConfig(row.avatarUrl),
        id: row.userId,
        nickname: row.nickname,
      },
    }));
  }

  async function getRequiredTeam(currentUser: CurrentUser) {
    const teamRecord = await findCurrentTeamRecord(currentUser);

    if (!teamRecord) {
      throw new ApiError(404, 'not_found', '还没有小队。');
    }

    return {
      members: await listMembers(teamRecord.id),
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
    const tokenHash = hashInviteToken(token);
    const [invite] = await db
      .select({
        acceptedAt: teamInvites.acceptedAt,
        expiresAt: teamInvites.expiresAt,
        id: teamInvites.id,
        inviterNickname: users.nickname,
        inviterUserId: teamInvites.inviterUserId,
        revokedAt: teamInvites.revokedAt,
        teamArchivedAt: teams.archivedAt,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(teamInvites)
      .innerJoin(teams, eq(teamInvites.teamId, teams.id))
      .innerJoin(users, eq(teamInvites.inviterUserId, users.id))
      .where(and(eq(teamInvites.tokenHash, tokenHash), isNull(teams.archivedAt), isNull(users.deletedAt)))
      .limit(1);

    if (!invite) {
      throw new ApiError(404, 'not_found', '没有找到这个邀请。');
    }

    ensureInviteIsUsable(invite);

    return invite;
  }

  return {
    async acceptInvite(currentUser, token, input) {
      const invite = await findUsableInviteByToken(token);
      const existingTeam = await findCurrentTeamRecord(currentUser);

      if (existingTeam) {
        throw new ApiError(409, 'conflict', '你已经在一个小队里了。');
      }

      const currentMembers = await listMembers(invite.teamId);

      if (currentMembers.length >= 4) {
        throw new ApiError(409, 'conflict', '小队已经满员了。');
      }

      await db.transaction(async (transaction) => {
        const now = new Date();
        const [acceptedInvite] = await transaction
          .update(teamInvites)
          .set({
            acceptedAt: now,
            acceptedByUserId: currentUser.id,
          })
          .where(
            and(
              eq(teamInvites.id, invite.id),
              isNull(teamInvites.acceptedAt),
              isNull(teamInvites.revokedAt),
              gt(teamInvites.expiresAt, now),
            ),
          )
          .returning({
            id: teamInvites.id,
          });

        if (!acceptedInvite) {
          throw new ApiError(409, 'conflict', '这个邀请已经不能使用了。');
        }

        await transaction.insert(teamMembers).values({
          displayName: input.displayName ?? currentUser.nickname,
          role: 'buddy',
          status: 'active',
          teamId: invite.teamId,
          userId: currentUser.id,
        });

        await transaction.insert(shareSettings).values({
          ...normalizeShareSettings(input.shareSettings),
          teamId: invite.teamId,
          userId: currentUser.id,
        });

      });

      return this.getCurrentTeam(currentUser);
    },
    async createInvite(currentUser) {
      const { members, teamRecord } = await getRequiredTeam(currentUser);

      ensureCanInvite(currentUser, teamRecord, members.length);

      const token = createInviteToken();
      const expiresAt = createInviteExpiration();
      const [invite] = await db
        .insert(teamInvites)
        .values({
          expiresAt,
          inviterUserId: currentUser.id,
          teamId: teamRecord.id,
          tokenHash: hashInviteToken(token),
        })
        .returning();

      if (!invite) {
        throw new Error('Failed to create team invite.');
      }

      return {
        expiresAt: invite.expiresAt.toISOString(),
        inviteId: invite.id,
        inviteUrl: createInviteUrl(token),
        token,
      };
    },
    async createTeam(currentUser, input) {
      const existingTeam = await findCurrentTeamRecord(currentUser);

      if (existingTeam) {
        throw new ApiError(409, 'conflict', '你已经有一个小队了。');
      }

      const teamName = normalizeTeamName(input.name);

      await db.transaction(async (transaction) => {
        const [createdTeam] = await transaction
          .insert(teams)
          .values({
            name: teamName,
            ownerUserId: currentUser.id,
          })
          .returning();

        if (!createdTeam) {
          throw new Error('Failed to create team.');
        }

        await transaction.insert(teamMembers).values({
          displayName: currentUser.nickname,
          role: 'owner',
          status: 'active',
          teamId: createdTeam.id,
          userId: currentUser.id,
        });

        await transaction.insert(shareSettings).values({
          teamId: createdTeam.id,
          userId: currentUser.id,
        });
      });

      return this.getCurrentTeam(currentUser);
    },
    async getCurrentTeam(currentUser) {
      const teamRecord = await findCurrentTeamRecord(currentUser);

      if (!teamRecord) {
        return { team: null };
      }

      return {
        team: toTeam(teamRecord, await listMembers(teamRecord.id)),
      };
    },
    async getCurrentTeamSnapshots(currentUser, date) {
      const { members, teamRecord } = await getRequiredTeam(currentUser);
      const memberUserIds = members.map((member) => member.user.id);
      const settingsRows = await db
        .select()
        .from(shareSettings)
        .where(eq(shareSettings.teamId, teamRecord.id));
      const snapshotRows = await db
        .select()
        .from(dailyShareSnapshots)
        .where(
          and(
            eq(dailyShareSnapshots.date, date),
            inArray(dailyShareSnapshots.userId, memberUserIds),
          ),
        );
      const settingsByUserId = new Map(settingsRows.map((row) => [row.userId, toShareSettings(row)]));
      const snapshotsByUserId = new Map(
        snapshotRows.map((row) => [row.userId, toDailyShareSnapshot(row)]),
      );

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

      await db.transaction(async (transaction) => {
        if (currentMember.role === 'owner') {
          await transaction
            .update(teams)
            .set({
              archivedAt: now,
              updatedAt: now,
            })
            .where(eq(teams.id, teamRecord.id));

          await transaction
            .update(teamMembers)
            .set({
              removedAt: now,
              status: 'removed',
            })
            .where(eq(teamMembers.teamId, teamRecord.id));
        } else {
          await transaction
            .update(teamMembers)
            .set({
              removedAt: now,
              status: 'removed',
            })
            .where(eq(teamMembers.id, currentMember.id));
        }

        await transaction
          .update(shareSettings)
          .set({
            paused: true,
            updatedAt: now,
          })
          .where(and(eq(shareSettings.teamId, teamRecord.id), eq(shareSettings.userId, currentUser.id)));
      });

      return this.getCurrentTeam(currentUser);
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

      await db.transaction(async (transaction) => {
        await transaction
          .update(teamMembers)
          .set({
            removedAt: now,
            status: 'removed',
          })
          .where(eq(teamMembers.id, member.id));

        await transaction
          .update(shareSettings)
          .set({
            paused: true,
            updatedAt: now,
          })
          .where(and(eq(shareSettings.teamId, teamRecord.id), eq(shareSettings.userId, member.user.id)));
      });

      return this.getCurrentTeam(currentUser);
    },
    async setCurrentMemberStatus(currentUser, status) {
      const { members, teamRecord } = await getRequiredTeam(currentUser);
      const currentMember = requireMember(members, currentUser);
      const now = new Date();

      await db.transaction(async (transaction) => {
        await transaction
          .update(teamMembers)
          .set({
            pausedAt: status === 'paused' ? now : null,
            status,
          })
          .where(eq(teamMembers.id, currentMember.id));

        await transaction
          .insert(shareSettings)
          .values({
            paused: status === 'paused',
            teamId: teamRecord.id,
            userId: currentUser.id,
          })
          .onConflictDoUpdate({
            set: {
              paused: status === 'paused',
              updatedAt: now,
            },
            target: [shareSettings.teamId, shareSettings.userId],
          });
      });

      return this.getCurrentTeam(currentUser);
    },
    async updateShareSettings(currentUser, input) {
      const { teamRecord } = await getRequiredTeam(currentUser);
      const [settings] = await db
        .insert(shareSettings)
        .values({
          ...input,
          teamId: teamRecord.id,
          userId: currentUser.id,
        })
        .onConflictDoUpdate({
          set: {
            ...input,
            updatedAt: new Date(),
          },
          target: [shareSettings.teamId, shareSettings.userId],
        })
        .returning();

      if (!settings) {
        throw new Error('Failed to update share settings.');
      }

      return {
        settings: toShareSettings(settings),
      };
    },
    async updateTeam(currentUser, input) {
      const { teamRecord } = await getRequiredTeam(currentUser);

      ensureOwner(currentUser, teamRecord);

      const [updatedTeam] = await db
        .update(teams)
        .set({
          name: normalizeTeamName(input.name),
          updatedAt: new Date(),
        })
        .where(eq(teams.id, teamRecord.id))
        .returning();

      if (!updatedTeam) {
        throw new Error('Failed to update team.');
      }

      return this.getCurrentTeam(currentUser);
    },
    async upsertDailyShareSnapshot(currentUser, snapshot) {
      await getRequiredTeam(currentUser);

      const [savedSnapshot] = await db
        .insert(dailyShareSnapshots)
        .values({
          date: snapshot.date,
          habitCompletion: snapshot.habitCompletion,
          streakDays: snapshot.streakDays,
          toiletRecorded: snapshot.toiletRecorded,
          trainingDone: snapshot.trainingDone,
          userId: currentUser.id,
        })
        .onConflictDoUpdate({
          set: {
            habitCompletion: snapshot.habitCompletion,
            streakDays: snapshot.streakDays,
            toiletRecorded: snapshot.toiletRecorded,
            trainingDone: snapshot.trainingDone,
            updatedAt: new Date(),
          },
          target: [dailyShareSnapshots.userId, dailyShareSnapshots.date],
        })
        .returning();

      if (!savedSnapshot) {
        throw new Error('Failed to save daily share snapshot.');
      }

      return {
        snapshot: toDailyShareSnapshot(savedSnapshot),
      };
    },
  };
}

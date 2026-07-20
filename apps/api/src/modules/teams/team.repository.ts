import { and, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm';

import type { DailyShareSnapshot, ShareSettings, TeamMemberStatus } from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import { dailyShareSnapshots, shareSettings, teamInvites, teamMembers, teams, users } from '../../db/schema.js';
import { deserializeAvatarConfig } from '../users/avatarConfig.js';
import { toDailyShareSnapshot, toShareSettings } from './team.mapper.js';
import type { MemberRecord, TeamRecord } from './team.types.js';

export type TeamInviteRecord = {
  acceptedAt: Date | null;
  expiresAt: Date;
  id: string;
  inviterNickname: string | null;
  inviterUserId: string;
  revokedAt: Date | null;
  teamArchivedAt: Date | null;
  teamId: string;
  teamName: string;
};

export type TeamShareSettingsRecord = {
  settings: ShareSettings;
  userId: string;
};

export type TeamShareSnapshotRecord = {
  snapshot: DailyShareSnapshot;
  userId: string;
};

export type TeamRepositoryQueries = {
  acceptInvite: (inviteId: string, userId: string, now: Date) => Promise<boolean>;
  archiveTeam: (teamId: string, now: Date) => Promise<void>;
  countCurrentMembers: (teamId: string) => Promise<number>;
  createInvite: (input: {
    expiresAt: Date;
    inviterUserId: string;
    teamId: string;
    tokenHash: string;
  }) => Promise<{ expiresAt: Date; id: string }>;
  createTeam: (ownerUserId: string, name: string) => Promise<TeamRecord>;
  findCurrentMembershipId: (userId: string) => Promise<string | null>;
  findCurrentTeam: (userId: string) => Promise<TeamRecord | null>;
  findInviteByTokenHash: (tokenHash: string) => Promise<TeamInviteRecord | null>;
  insertMember: (input: {
    displayName: string | null;
    role: 'buddy' | 'owner';
    teamId: string;
    userId: string;
  }) => Promise<void>;
  insertShareSettings: (teamId: string, userId: string, settings?: ShareSettings) => Promise<void>;
  listDailyShareSnapshots: (date: string, userIds: string[]) => Promise<TeamShareSnapshotRecord[]>;
  listMembers: (teamId: string) => Promise<MemberRecord[]>;
  listShareSettings: (teamId: string) => Promise<TeamShareSettingsRecord[]>;
  lockTeam: (teamId: string) => Promise<void>;
  lockUser: (userId: string) => Promise<void>;
  pauseShareSettings: (teamId: string, userId: string, now: Date) => Promise<void>;
  removeAllMembers: (teamId: string, now: Date) => Promise<void>;
  removeMember: (memberId: string, now: Date) => Promise<void>;
  setMemberStatus: (
    memberId: string,
    status: Extract<TeamMemberStatus, 'active' | 'paused'>,
    now: Date,
  ) => Promise<void>;
  updateTeamName: (teamId: string, name: string, now: Date) => Promise<void>;
  upsertDailyShareSnapshot: (userId: string, snapshot: DailyShareSnapshot) => Promise<DailyShareSnapshot>;
  upsertMemberSharePause: (teamId: string, userId: string, paused: boolean, now: Date) => Promise<void>;
  upsertShareSettings: (teamId: string, userId: string, input: Partial<ShareSettings>) => Promise<ShareSettings>;
};

export type TeamRepository = TeamRepositoryQueries & {
  withTransaction: <T>(work: (repository: TeamRepositoryQueries) => Promise<T>) => Promise<T>;
};

function createTeamRepositoryQueries(db: Database): TeamRepositoryQueries {
  return {
    async acceptInvite(inviteId, userId, now) {
      const [acceptedInvite] = await db
        .update(teamInvites)
        .set({ acceptedAt: now, acceptedByUserId: userId })
        .where(
          and(
            eq(teamInvites.id, inviteId),
            isNull(teamInvites.acceptedAt),
            isNull(teamInvites.revokedAt),
            gt(teamInvites.expiresAt, now),
          ),
        )
        .returning({ id: teamInvites.id });

      return Boolean(acceptedInvite);
    },
    async archiveTeam(teamId, now) {
      await db.update(teams).set({ archivedAt: now, updatedAt: now }).where(eq(teams.id, teamId));
    },
    async countCurrentMembers(teamId) {
      const members = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.removedAt)));

      return members.length;
    },
    async createInvite(input) {
      const [invite] = await db.insert(teamInvites).values(input).returning({
        expiresAt: teamInvites.expiresAt,
        id: teamInvites.id,
      });

      if (!invite) {
        throw new Error('Failed to create team invite.');
      }

      return invite;
    },
    async createTeam(ownerUserId, name) {
      const [team] = await db.insert(teams).values({ name, ownerUserId }).returning();

      if (!team) {
        throw new Error('Failed to create team.');
      }

      return team;
    },
    async findCurrentMembershipId(userId) {
      const [membership] = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(and(eq(teamMembers.userId, userId), isNull(teamMembers.removedAt), isNull(teams.archivedAt)))
        .limit(1);

      return membership?.id ?? null;
    },
    async findCurrentTeam(userId) {
      const [team] = await db
        .select({
          archivedAt: teams.archivedAt,
          id: teams.id,
          name: teams.name,
          ownerUserId: teams.ownerUserId,
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(and(eq(teamMembers.userId, userId), ne(teamMembers.status, 'removed'), isNull(teams.archivedAt)))
        .limit(1);

      return team ?? null;
    },
    async findInviteByTokenHash(tokenHash) {
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

      return invite ?? null;
    },
    async insertMember(input) {
      await db.insert(teamMembers).values({ ...input, status: 'active' });
    },
    async insertShareSettings(teamId, userId, settings) {
      await db.insert(shareSettings).values({ ...settings, teamId, userId });
    },
    async listDailyShareSnapshots(date, userIds) {
      if (userIds.length === 0) {
        return [];
      }

      const records = await db
        .select()
        .from(dailyShareSnapshots)
        .where(and(eq(dailyShareSnapshots.date, date), inArray(dailyShareSnapshots.userId, userIds)));

      return records.map((record) => ({ snapshot: toDailyShareSnapshot(record), userId: record.userId }));
    },
    async listMembers(teamId) {
      const records = await db
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

      return records.map((record) => ({
        displayName: record.displayName,
        id: record.id,
        joinedAt: record.joinedAt,
        role: record.role,
        status: record.status,
        user: {
          avatarUrl: deserializeAvatarConfig(record.avatarUrl),
          id: record.userId,
          nickname: record.nickname,
        },
      }));
    },
    async listShareSettings(teamId) {
      const records = await db.select().from(shareSettings).where(eq(shareSettings.teamId, teamId));
      return records.map((record) => ({ settings: toShareSettings(record), userId: record.userId }));
    },
    async lockTeam(teamId) {
      await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).for('update');
    },
    async lockUser(userId) {
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
    },
    async pauseShareSettings(teamId, userId, now) {
      await db
        .update(shareSettings)
        .set({ paused: true, updatedAt: now })
        .where(and(eq(shareSettings.teamId, teamId), eq(shareSettings.userId, userId)));
    },
    async removeAllMembers(teamId, now) {
      await db.update(teamMembers).set({ removedAt: now, status: 'removed' }).where(eq(teamMembers.teamId, teamId));
    },
    async removeMember(memberId, now) {
      await db.update(teamMembers).set({ removedAt: now, status: 'removed' }).where(eq(teamMembers.id, memberId));
    },
    async setMemberStatus(memberId, status, now) {
      await db
        .update(teamMembers)
        .set({ pausedAt: status === 'paused' ? now : null, status })
        .where(eq(teamMembers.id, memberId));
    },
    async updateTeamName(teamId, name, now) {
      await db.update(teams).set({ name, updatedAt: now }).where(eq(teams.id, teamId));
    },
    async upsertDailyShareSnapshot(userId, snapshot) {
      const [savedSnapshot] = await db
        .insert(dailyShareSnapshots)
        .values({ ...snapshot, userId })
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

      return toDailyShareSnapshot(savedSnapshot);
    },
    async upsertMemberSharePause(teamId, userId, paused, now) {
      await db
        .insert(shareSettings)
        .values({ paused, teamId, userId })
        .onConflictDoUpdate({
          set: { paused, updatedAt: now },
          target: [shareSettings.teamId, shareSettings.userId],
        });
    },
    async upsertShareSettings(teamId, userId, input) {
      const [settings] = await db
        .insert(shareSettings)
        .values({ ...input, teamId, userId })
        .onConflictDoUpdate({
          set: { ...input, updatedAt: new Date() },
          target: [shareSettings.teamId, shareSettings.userId],
        })
        .returning();

      if (!settings) {
        throw new Error('Failed to update share settings.');
      }

      return toShareSettings(settings);
    },
  };
}

export function createDrizzleTeamRepository(db: Database): TeamRepository {
  return {
    ...createTeamRepositoryQueries(db),
    withTransaction: (work) =>
      db.transaction((transaction) => work(createTeamRepositoryQueries(transaction as unknown as Database))),
  };
}

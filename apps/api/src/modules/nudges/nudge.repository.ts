import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type {
  BuddyNudge,
  BuddyNudgeAck,
  BuddyNudgeAckStatus,
  BuddyNudgeSettings,
  BuddyNudgeType,
} from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import {
  buddyNudgeAcks,
  buddyNudgeDailyCounters,
  buddyNudges,
  buddyNudgeSettings,
  teamMembers,
  teams,
  users,
} from '../../db/schema.js';
import { deserializeAvatarConfig } from '../users/avatarConfig.js';
import { toAck, toNudge, toSettings } from './nudge.mapper.js';
import type { NudgeRecord, TeamMemberSummary } from './nudge.types.js';

const fromUsers = alias(users, 'nudge_from_users');
const toUsers = alias(users, 'nudge_to_users');
const nudgeSelection = {
  ackCreatedAt: buddyNudgeAcks.createdAt,
  ackRevisionCount: buddyNudgeAcks.revisionCount,
  ackStatus: buddyNudgeAcks.status,
  ackUpdatedAt: buddyNudgeAcks.updatedAt,
  createdAt: buddyNudges.createdAt,
  expiresAt: buddyNudges.expiresAt,
  fromAvatarUrl: fromUsers.avatarUrl,
  fromNickname: fromUsers.nickname,
  fromUserId: fromUsers.id,
  id: buddyNudges.id,
  messageTemplate: buddyNudges.messageTemplate,
  teamId: buddyNudges.teamId,
  toAvatarUrl: toUsers.avatarUrl,
  toNickname: toUsers.nickname,
  toUserId: toUsers.id,
  type: buddyNudges.type,
};

type JoinedNudgeRow = {
  ackCreatedAt: Date | null;
  ackRevisionCount: number | null;
  ackStatus: BuddyNudgeAckStatus | null;
  ackUpdatedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
  fromAvatarUrl: string | null;
  fromNickname: string | null;
  fromUserId: string;
  id: string;
  messageTemplate: string;
  teamId: string;
  toAvatarUrl: string | null;
  toNickname: string | null;
  toUserId: string;
  type: BuddyNudgeType;
};

export type NudgeTeamRecord = {
  id: string;
  name: string;
  ownerUserId: string;
};

export type CreatedNudgeRecord = {
  id: string;
  messageTemplate: string;
  teamId: string;
  toUserId: string;
  type: BuddyNudgeType;
};

export type NudgeRepositoryQueries = {
  createAck: (nudgeId: string, userId: string, status: BuddyNudgeAckStatus) => Promise<BuddyNudgeAck | null>;
  createNudge: (input: {
    expiresAt: Date;
    fromUserId: string;
    messageTemplate: string;
    teamId: string;
    toUserId: string;
    type: BuddyNudgeType;
  }) => Promise<CreatedNudgeRecord>;
  findAck: (nudgeId: string, userId: string) => Promise<BuddyNudgeAck | null>;
  findCurrentTeam: (userId: string) => Promise<NudgeTeamRecord | null>;
  findNudge: (nudgeId: string) => Promise<BuddyNudge | null>;
  findSettings: (teamId: string, userId: string, buddyUserId: string) => Promise<BuddyNudgeSettings | null>;
  findUserTimezone: (userId: string) => Promise<string | null>;
  incrementDailyCounter: (fromUserId: string, toUserId: string, localDate: string, now: Date) => Promise<number>;
  listNudgesByUser: (direction: 'from' | 'to', userId: string, limit: number) => Promise<BuddyNudge[]>;
  listSettings: (teamId: string, userId: string) => Promise<BuddyNudgeSettings[]>;
  listTeamMembers: (teamId: string) => Promise<TeamMemberSummary[]>;
  listTeamNudges: (teamId: string, userId: string, limit: number) => Promise<BuddyNudge[]>;
  listThreadNudges: (input: {
    before?: Date;
    buddyUserId: string;
    limit: number;
    teamId: string;
    userId: string;
  }) => Promise<BuddyNudge[]>;
  reviseAck: (
    nudgeId: string,
    userId: string,
    status: BuddyNudgeAckStatus,
    now: Date,
    revisionCutoff: Date,
  ) => Promise<BuddyNudgeAck | null>;
  upsertSettings: (
    teamId: string,
    userId: string,
    buddyUserId: string,
    input: Pick<BuddyNudgeSettings, 'dailyLimit' | 'enabled' | 'quietRanges'>,
  ) => Promise<BuddyNudgeSettings>;
};

export type NudgeRepository = NudgeRepositoryQueries & {
  withTransaction: <T>(work: (repository: NudgeRepositoryQueries) => Promise<T>) => Promise<T>;
};

function joinedRowToNudge(row: JoinedNudgeRow) {
  return toNudge({
    ack:
      row.ackCreatedAt && row.ackStatus && row.ackUpdatedAt
        ? toAck({
            createdAt: row.ackCreatedAt,
            revisionCount: row.ackRevisionCount ?? 0,
            status: row.ackStatus,
            updatedAt: row.ackUpdatedAt,
          })
        : null,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    fromUser: {
      avatarUrl: deserializeAvatarConfig(row.fromAvatarUrl),
      id: row.fromUserId,
      nickname: row.fromNickname,
    },
    id: row.id,
    messageTemplate: row.messageTemplate,
    teamId: row.teamId,
    toUser: {
      avatarUrl: deserializeAvatarConfig(row.toAvatarUrl),
      id: row.toUserId,
      nickname: row.toNickname,
    },
    type: row.type,
  } satisfies NudgeRecord);
}

function selectNudges(db: Database) {
  return db
    .select(nudgeSelection)
    .from(buddyNudges)
    .innerJoin(fromUsers, eq(buddyNudges.fromUserId, fromUsers.id))
    .innerJoin(toUsers, eq(buddyNudges.toUserId, toUsers.id))
    .leftJoin(buddyNudgeAcks, eq(buddyNudgeAcks.nudgeId, buddyNudges.id));
}

function createNudgeRepositoryQueries(db: Database): NudgeRepositoryQueries {
  return {
    async createAck(nudgeId, userId, status) {
      const [ack] = await db
        .insert(buddyNudgeAcks)
        .values({ nudgeId, status, userId })
        .onConflictDoNothing({ target: [buddyNudgeAcks.nudgeId, buddyNudgeAcks.userId] })
        .returning();

      return ack ? toAck(ack) : null;
    },
    async createNudge(input) {
      const [nudge] = await db.insert(buddyNudges).values(input).returning({
        id: buddyNudges.id,
        messageTemplate: buddyNudges.messageTemplate,
        teamId: buddyNudges.teamId,
        toUserId: buddyNudges.toUserId,
        type: buddyNudges.type,
      });

      if (!nudge) {
        throw new Error('Failed to create nudge.');
      }

      return nudge;
    },
    async findAck(nudgeId, userId) {
      const [ack] = await db
        .select()
        .from(buddyNudgeAcks)
        .where(and(eq(buddyNudgeAcks.nudgeId, nudgeId), eq(buddyNudgeAcks.userId, userId)))
        .limit(1);

      return ack ? toAck(ack) : null;
    },
    async findCurrentTeam(userId) {
      const [team] = await db
        .select({ id: teams.id, name: teams.name, ownerUserId: teams.ownerUserId })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(and(eq(teamMembers.userId, userId), eq(teamMembers.status, 'active'), isNull(teams.archivedAt)))
        .limit(1);

      return team ?? null;
    },
    async findNudge(nudgeId) {
      const [row] = await selectNudges(db).where(eq(buddyNudges.id, nudgeId)).limit(1);
      return row ? joinedRowToNudge(row) : null;
    },
    async findSettings(teamId, userId, buddyUserId) {
      const [settings] = await db
        .select()
        .from(buddyNudgeSettings)
        .where(
          and(
            eq(buddyNudgeSettings.teamId, teamId),
            eq(buddyNudgeSettings.userId, userId),
            eq(buddyNudgeSettings.buddyUserId, buddyUserId),
          ),
        )
        .limit(1);

      return settings ? toSettings(settings) : null;
    },
    async findUserTimezone(userId) {
      const [user] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
      return user?.timezone ?? null;
    },
    async incrementDailyCounter(fromUserId, toUserId, localDate, now) {
      const [counter] = await db
        .insert(buddyNudgeDailyCounters)
        .values({ count: 1, fromUserId, localDate, toUserId })
        .onConflictDoUpdate({
          set: { count: sql`${buddyNudgeDailyCounters.count} + 1`, updatedAt: now },
          target: [
            buddyNudgeDailyCounters.fromUserId,
            buddyNudgeDailyCounters.toUserId,
            buddyNudgeDailyCounters.localDate,
          ],
        })
        .returning({ count: buddyNudgeDailyCounters.count });

      if (!counter) {
        throw new Error('Failed to increment nudge daily counter.');
      }

      return counter.count;
    },
    async listNudgesByUser(direction, userId, limit) {
      const rows = await selectNudges(db)
        .where(eq(direction === 'from' ? buddyNudges.fromUserId : buddyNudges.toUserId, userId))
        .orderBy(desc(buddyNudges.createdAt))
        .limit(limit);
      return rows.map(joinedRowToNudge);
    },
    async listSettings(teamId, userId) {
      const settings = await db
        .select()
        .from(buddyNudgeSettings)
        .where(and(eq(buddyNudgeSettings.teamId, teamId), eq(buddyNudgeSettings.userId, userId)));
      return settings.map(toSettings);
    },
    async listTeamMembers(teamId) {
      const members = await db
        .select({
          avatarUrl: users.avatarUrl,
          nickname: users.nickname,
          role: teamMembers.role,
          status: teamMembers.status,
          userId: users.id,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .where(and(eq(teamMembers.teamId, teamId), isNull(users.deletedAt)));

      return members.map((member) => ({
        role: member.role,
        status: member.status,
        user: {
          avatarUrl: deserializeAvatarConfig(member.avatarUrl),
          id: member.userId,
          nickname: member.nickname,
        },
      }));
    },
    async listTeamNudges(teamId, userId, limit) {
      const rows = await selectNudges(db)
        .where(
          and(eq(buddyNudges.teamId, teamId), or(eq(buddyNudges.fromUserId, userId), eq(buddyNudges.toUserId, userId))),
        )
        .orderBy(desc(buddyNudges.createdAt))
        .limit(limit);
      return rows.map(joinedRowToNudge);
    },
    async listThreadNudges(input) {
      const participantFilter = or(
        and(eq(buddyNudges.fromUserId, input.userId), eq(buddyNudges.toUserId, input.buddyUserId)),
        and(eq(buddyNudges.fromUserId, input.buddyUserId), eq(buddyNudges.toUserId, input.userId)),
      );
      const rows = await selectNudges(db)
        .where(
          input.before
            ? and(eq(buddyNudges.teamId, input.teamId), participantFilter, lt(buddyNudges.createdAt, input.before))
            : and(eq(buddyNudges.teamId, input.teamId), participantFilter),
        )
        .orderBy(desc(buddyNudges.createdAt))
        .limit(input.limit);
      return rows.map(joinedRowToNudge);
    },
    async reviseAck(nudgeId, userId, status, now, revisionCutoff) {
      const [ack] = await db
        .update(buddyNudgeAcks)
        .set({ revisionCount: 1, status, updatedAt: now })
        .where(
          and(
            eq(buddyNudgeAcks.nudgeId, nudgeId),
            eq(buddyNudgeAcks.userId, userId),
            eq(buddyNudgeAcks.revisionCount, 0),
            gt(buddyNudgeAcks.createdAt, revisionCutoff),
          ),
        )
        .returning();
      return ack ? toAck(ack) : null;
    },
    async upsertSettings(teamId, userId, buddyUserId, input) {
      const [settings] = await db
        .insert(buddyNudgeSettings)
        .values({ ...input, buddyUserId, teamId, userId })
        .onConflictDoUpdate({
          set: { ...input, updatedAt: new Date() },
          target: [buddyNudgeSettings.teamId, buddyNudgeSettings.userId, buddyNudgeSettings.buddyUserId],
        })
        .returning();

      if (!settings) {
        throw new Error('Failed to update buddy nudge settings.');
      }

      return toSettings(settings);
    },
  };
}

export function createDrizzleNudgeRepository(db: Database): NudgeRepository {
  return {
    ...createNudgeRepositoryQueries(db),
    withTransaction: (work) =>
      db.transaction((transaction) => work(createNudgeRepositoryQueries(transaction as unknown as Database))),
  };
}

import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type {
  BuddyNudge,
  BuddyNudgeAckResponse,
  BuddyNudgeAckStatus,
  BuddyNudgeSettingsResponse,
  BuddyNudgeThreadResponse,
  BuddyNudgesResponse,
  CreateBuddyNudgeRequest,
  NudgeThreadsResponse,
  Team,
  UpdateBuddyNudgeSettingsRequest,
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
import { ApiError } from '../../http/apiError.js';
import { createNoopPushNotificationService, type PushNotificationService } from '../push/pushNotificationService.js';
import { deserializeAvatarConfig } from '../users/avatarConfig.js';
import type { CurrentUser } from '../users/userTypes.js';
import { toAck, toNudge, toNudgeThreadSummaries, toSettings } from './nudge.mapper.js';
import {
  ackNotificationMessages,
  ackRevisionWindowMs,
  assertCanNudge,
  defaultTimezone,
  notifySafely,
  nudgeMessages,
  nudgeTtlMs,
  requireBuddyMember,
  todayDateKeyInTimezone,
} from './nudge.policy.js';
import type { TeamMemberSummary } from './nudge.types.js';

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

export type NudgeService = {
  ackNudge: (currentUser: CurrentUser, nudgeId: string, status: BuddyNudgeAckStatus) => Promise<BuddyNudgeAckResponse>;
  createNudge: (currentUser: CurrentUser, input: CreateBuddyNudgeRequest) => Promise<BuddyNudge>;
  getSettings: (currentUser: CurrentUser) => Promise<BuddyNudgeSettingsResponse>;
  listInbox: (currentUser: CurrentUser) => Promise<BuddyNudgesResponse>;
  listSent: (currentUser: CurrentUser) => Promise<BuddyNudgesResponse>;
  listThreads: (currentUser: CurrentUser) => Promise<NudgeThreadsResponse>;
  listThread: (
    currentUser: CurrentUser,
    buddyUserId: string,
    options: ListNudgeThreadOptions,
  ) => Promise<BuddyNudgeThreadResponse>;
  updateSettings: (
    currentUser: CurrentUser,
    buddyUserId: string,
    input: UpdateBuddyNudgeSettingsRequest,
  ) => Promise<BuddyNudgeSettingsResponse>;
};

export type ListNudgeThreadOptions = {
  before?: Date;
  limit: number;
};

export { createMockNudgeService } from './nudge.mock.js';

export function createDrizzleNudgeService(
  db: Database,
  options: { pushNotificationService?: PushNotificationService } = {},
): NudgeService {
  const pushNotificationService = options.pushNotificationService ?? createNoopPushNotificationService();

  async function findCurrentTeam(currentUser: CurrentUser) {
    const [teamRow] = await db
      .select({
        id: teams.id,
        name: teams.name,
        ownerUserId: teams.ownerUserId,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(and(eq(teamMembers.userId, currentUser.id), eq(teamMembers.status, 'active'), isNull(teams.archivedAt)))
      .limit(1);

    if (!teamRow) {
      throw new ApiError(404, 'not_found', '还没有小队。');
    }

    return teamRow;
  }

  async function listTeamMembers(teamId: string): Promise<TeamMemberSummary[]> {
    const rows = await db
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

    return rows.map((row) => ({
      role: row.role,
      status: row.status,
      user: {
        avatarUrl: deserializeAvatarConfig(row.avatarUrl),
        id: row.userId,
        nickname: row.nickname,
      },
    }));
  }

  async function getTeamForNudge(currentUser: CurrentUser): Promise<Team> {
    const team = await findCurrentTeam(currentUser);
    const members = await listTeamMembers(team.id);

    return {
      id: team.id,
      members: members.map((member) => ({
        displayName: null,
        id: member.user.id,
        joinedAt: new Date().toISOString(),
        role: member.role,
        status: member.status,
        user: member.user,
      })),
      name: team.name,
      ownerUserId: team.ownerUserId,
    };
  }

  async function findUserTimezone(userId: string) {
    const [user] = await db
      .select({
        timezone: users.timezone,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user?.timezone ?? defaultTimezone;
  }

  function joinedRowToNudge(row: Awaited<ReturnType<typeof selectNudges>>[number]) {
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
    });
  }

  function selectNudges() {
    return db
      .select(nudgeSelection)
      .from(buddyNudges)
      .innerJoin(fromUsers, eq(buddyNudges.fromUserId, fromUsers.id))
      .innerJoin(toUsers, eq(buddyNudges.toUserId, toUsers.id))
      .leftJoin(buddyNudgeAcks, eq(buddyNudgeAcks.nudgeId, buddyNudges.id));
  }

  async function getNudgeRecord(nudgeId: string) {
    const [row] = await selectNudges().where(eq(buddyNudges.id, nudgeId)).limit(1);

    if (!row) {
      throw new ApiError(404, 'not_found', '没有找到这条提醒。');
    }
    return joinedRowToNudge(row);
  }

  async function listNudgesBy(field: 'from' | 'to', userId: string) {
    const rows = await selectNudges()
      .where(eq(field === 'from' ? buddyNudges.fromUserId : buddyNudges.toUserId, userId))
      .orderBy(desc(buddyNudges.createdAt))
      .limit(50);

    return {
      nudges: rows.map(joinedRowToNudge),
    };
  }

  async function listThreadNudges(
    currentUser: CurrentUser,
    buddyUserId: string,
    options: ListNudgeThreadOptions,
  ): Promise<BuddyNudgeThreadResponse> {
    const team = await getTeamForNudge(currentUser);
    requireBuddyMember(team, currentUser, buddyUserId);
    const participantFilter = or(
      and(eq(buddyNudges.fromUserId, currentUser.id), eq(buddyNudges.toUserId, buddyUserId)),
      and(eq(buddyNudges.fromUserId, buddyUserId), eq(buddyNudges.toUserId, currentUser.id)),
    );
    const rows = await selectNudges()
      .where(
        options.before
          ? and(eq(buddyNudges.teamId, team.id), participantFilter, lt(buddyNudges.createdAt, options.before))
          : and(eq(buddyNudges.teamId, team.id), participantFilter),
      )
      .orderBy(desc(buddyNudges.createdAt))
      .limit(options.limit + 1);
    const page = rows.slice(0, options.limit);
    const hasMore = rows.length > options.limit;

    return {
      hasMore,
      nextCursor: hasMore ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
      nudges: page.map(joinedRowToNudge),
    };
  }

  async function getExplicitSettings(teamId: string, userId: string, buddyUserId: string) {
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

    return settings
      ? toSettings({
          buddyUserId: settings.buddyUserId,
          dailyLimit: settings.dailyLimit,
          enabled: settings.enabled,
          quietRanges: settings.quietRanges,
          teamId: settings.teamId,
          userId: settings.userId,
        })
      : null;
  }

  return {
    async ackNudge(currentUser, nudgeId, status) {
      const [nudge] = await db.select().from(buddyNudges).where(eq(buddyNudges.id, nudgeId)).limit(1);

      if (!nudge) {
        throw new ApiError(404, 'not_found', '没有找到这条提醒。');
      }

      if (nudge.toUserId !== currentUser.id) {
        throw new ApiError(403, 'forbidden', '只能回复发给自己的提醒。');
      }

      const now = new Date();
      const [createdAck] = await db
        .insert(buddyNudgeAcks)
        .values({ nudgeId, status, userId: currentUser.id })
        .onConflictDoNothing({ target: [buddyNudgeAcks.nudgeId, buddyNudgeAcks.userId] })
        .returning();

      if (createdAck) {
        await notifySafely(pushNotificationService, {
          body: ackNotificationMessages[status],
          data: {
            kind: 'buddy-nudge-ack',
            nudgeId,
            status,
          },
          title: '搭子有回音了',
          userId: nudge.fromUserId,
        });

        return { ack: toAck(createdAck) };
      }

      const [updatedAck] = await db
        .update(buddyNudgeAcks)
        .set({
          revisionCount: 1,
          status,
          updatedAt: now,
        })
        .where(
          and(
            eq(buddyNudgeAcks.nudgeId, nudgeId),
            eq(buddyNudgeAcks.userId, currentUser.id),
            eq(buddyNudgeAcks.revisionCount, 0),
            gt(buddyNudgeAcks.createdAt, new Date(now.getTime() - ackRevisionWindowMs)),
          ),
        )
        .returning();

      if (!updatedAck) {
        throw new ApiError(409, 'conflict', '这条回执已经不能修改了。');
      }
      await notifySafely(pushNotificationService, {
        body: ackNotificationMessages[status],
        data: {
          kind: 'buddy-nudge-ack',
          nudgeId,
          status,
        },
        title: '搭子有回音了',
        userId: nudge.fromUserId,
      });

      return { ack: toAck(updatedAck) };
    },
    async createNudge(currentUser, input) {
      const team = await getTeamForNudge(currentUser);
      const settings =
        (await getExplicitSettings(team.id, input.toUserId, currentUser.id)) ??
        toSettings({
          buddyUserId: currentUser.id,
          teamId: team.id,
          userId: input.toUserId,
        });
      const recipientTimezone = await findUserTimezone(input.toUserId);
      assertCanNudge({
        currentUser,
        recipientTimezone,
        settings,
        team,
        toUserId: input.toUserId,
        todayCount: 0,
      });

      const now = new Date();
      const nudge = await db.transaction(async (transaction) => {
        const [counter] = await transaction
          .insert(buddyNudgeDailyCounters)
          .values({
            count: 1,
            fromUserId: currentUser.id,
            localDate: todayDateKeyInTimezone(recipientTimezone, now),
            toUserId: input.toUserId,
          })
          .onConflictDoUpdate({
            set: { count: sql`${buddyNudgeDailyCounters.count} + 1`, updatedAt: now },
            target: [
              buddyNudgeDailyCounters.fromUserId,
              buddyNudgeDailyCounters.toUserId,
              buddyNudgeDailyCounters.localDate,
            ],
          })
          .returning({ count: buddyNudgeDailyCounters.count });

        if (!counter || counter.count > settings.dailyLimit) {
          throw new ApiError(429, 'rate_limited', '今天已经轻轻戳够了，明天再来。');
        }

        const [created] = await transaction
          .insert(buddyNudges)
          .values({
            expiresAt: new Date(now.getTime() + nudgeTtlMs),
            fromUserId: currentUser.id,
            messageTemplate: nudgeMessages[input.type],
            teamId: team.id,
            toUserId: input.toUserId,
            type: input.type,
          })
          .returning();
        return created;
      });

      if (!nudge) {
        throw new Error('Failed to create nudge.');
      }
      await notifySafely(pushNotificationService, {
        body: nudge.messageTemplate,
        data: {
          kind: 'buddy-nudge',
          nudgeId: nudge.id,
          teamId: nudge.teamId,
          type: nudge.type,
        },
        title: '搭子轻轻戳了你一下',
        userId: nudge.toUserId,
      });

      return getNudgeRecord(nudge.id);
    },
    async getSettings(currentUser) {
      const team = await getTeamForNudge(currentUser);
      const members = team.members.filter((member) => member.user.id !== currentUser.id && member.status !== 'removed');
      const settings = await Promise.all(
        members.map(async (member) =>
          toSettings({
            ...((await getExplicitSettings(team.id, currentUser.id, member.user.id)) ?? {}),
            buddyUserId: member.user.id,
            teamId: team.id,
            userId: currentUser.id,
          }),
        ),
      );

      return { settings };
    },
    async listInbox(currentUser) {
      return listNudgesBy('to', currentUser.id);
    },
    async listSent(currentUser) {
      return listNudgesBy('from', currentUser.id);
    },
    async listThreads(currentUser) {
      const team = await getTeamForNudge(currentUser);
      const rows = await selectNudges()
        .where(
          and(
            eq(buddyNudges.teamId, team.id),
            or(eq(buddyNudges.fromUserId, currentUser.id), eq(buddyNudges.toUserId, currentUser.id)),
          ),
        )
        .orderBy(desc(buddyNudges.createdAt))
        .limit(200);
      return {
        threads: toNudgeThreadSummaries(currentUser.id, team.members, rows.map(joinedRowToNudge)),
      };
    },
    async listThread(currentUser, buddyUserId, options) {
      return listThreadNudges(currentUser, buddyUserId, options);
    },
    async updateSettings(currentUser, buddyUserId, input) {
      const team = await getTeamForNudge(currentUser);
      requireBuddyMember(team, currentUser, buddyUserId);

      const [settings] = await db
        .insert(buddyNudgeSettings)
        .values({
          buddyUserId,
          dailyLimit: input.dailyLimit,
          enabled: input.enabled,
          quietRanges: input.quietRanges,
          teamId: team.id,
          userId: currentUser.id,
        })
        .onConflictDoUpdate({
          set: {
            dailyLimit: input.dailyLimit,
            enabled: input.enabled,
            quietRanges: input.quietRanges,
            updatedAt: new Date(),
          },
          target: [buddyNudgeSettings.teamId, buddyNudgeSettings.userId, buddyNudgeSettings.buddyUserId],
        })
        .returning();

      if (!settings) {
        throw new Error('Failed to update buddy nudge settings.');
      }

      return {
        settings: [
          toSettings({
            buddyUserId: settings.buddyUserId,
            dailyLimit: settings.dailyLimit,
            enabled: settings.enabled,
            quietRanges: settings.quietRanges,
            teamId: settings.teamId,
            userId: settings.userId,
          }),
        ],
      };
    },
  };
}

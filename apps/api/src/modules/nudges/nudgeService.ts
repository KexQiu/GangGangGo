import { and, desc, eq, gte, isNull } from 'drizzle-orm';

import type {
  BuddyNudge,
  BuddyNudgeAck,
  BuddyNudgeAckResponse,
  BuddyNudgeAckStatus,
  BuddyNudgeDailyLimit,
  BuddyNudgeSettings,
  BuddyNudgeSettingsResponse,
  BuddyNudgeType,
  BuddyNudgesResponse,
  CreateBuddyNudgeRequest,
  Team,
  UpdateBuddyNudgeSettingsRequest,
  UserProfile,
} from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import {
  buddyNudgeAcks,
  buddyNudges,
  buddyNudgeSettings,
  teamMembers,
  teams,
  users,
} from '../../db/schema.js';
import { ApiError } from '../../http/apiError.js';
import {
  createNoopPushNotificationService,
  type PushNotificationService,
} from '../push/pushNotificationService.js';
import type { TeamService } from '../teams/teamService.js';
import type { CurrentUser } from '../users/userTypes.js';

export type NudgeService = {
  ackNudge: (
    currentUser: CurrentUser,
    nudgeId: string,
    status: BuddyNudgeAckStatus,
  ) => Promise<BuddyNudgeAckResponse>;
  createNudge: (currentUser: CurrentUser, input: CreateBuddyNudgeRequest) => Promise<BuddyNudge>;
  getSettings: (currentUser: CurrentUser) => Promise<BuddyNudgeSettingsResponse>;
  listInbox: (currentUser: CurrentUser) => Promise<BuddyNudgesResponse>;
  listSent: (currentUser: CurrentUser) => Promise<BuddyNudgesResponse>;
  updateSettings: (
    currentUser: CurrentUser,
    buddyUserId: string,
    input: UpdateBuddyNudgeSettingsRequest,
  ) => Promise<BuddyNudgeSettingsResponse>;
};

type NudgeRecord = {
  ack: BuddyNudgeAck | null;
  createdAt: Date;
  expiresAt: Date;
  fromUser: Pick<UserProfile, 'avatarUrl' | 'id' | 'nickname'>;
  id: string;
  messageTemplate: string;
  teamId: string;
  toUser: Pick<UserProfile, 'avatarUrl' | 'id' | 'nickname'>;
  type: BuddyNudgeType;
};

type TeamMemberSummary = {
  role: 'buddy' | 'owner';
  status: 'active' | 'paused' | 'removed';
  user: Pick<UserProfile, 'avatarUrl' | 'id' | 'nickname'>;
};

const defaultDailyLimit: BuddyNudgeDailyLimit = 5;
const nudgeTtlMs = 24 * 60 * 60 * 1000;
const ackRevisionWindowMs = 30 * 60 * 1000;

const nudgeMessages: Record<BuddyNudgeType, string> = {
  gentle: '轻轻戳一下，今天别空白。',
  habit_left: '小账本还差一点，顺手补一笔。',
  move: '起来活动一下，换个姿势。',
  not_blank: '今天别空白，做一点也算数。',
  posture: '该换个姿势了，别坐成雕像。',
};

const ackNotificationMessages: Record<BuddyNudgeAckStatus, string> = {
  done: '对方说已完成。',
  later: '对方说等会儿。',
  received: '对方说收到了。',
};

function parseTimeToMinutes(time: string) {
  const [hour = '0', minute = '0'] = time.split(':');
  return Number(hour) * 60 + Number(minute);
}

function isInQuietRanges(
  quietRanges: Array<{ end: string; start: string }>,
  now = new Date(),
) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return quietRanges.some((range) => {
    const startMinutes = parseTimeToMinutes(range.start);
    const endMinutes = parseTimeToMinutes(range.end);

    if (startMinutes === endMinutes) {
      return true;
    }

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  });
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function toAck(input: {
  createdAt: Date | string;
  revisionCount: number;
  status: BuddyNudgeAckStatus;
  updatedAt: Date | string;
}): BuddyNudgeAck {
  return {
    createdAt: toIsoString(input.createdAt),
    revisionCount: input.revisionCount as 0 | 1,
    status: input.status,
    updatedAt: toIsoString(input.updatedAt),
  };
}

function toNudge(record: NudgeRecord): BuddyNudge {
  return {
    ack: record.ack,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    fromUser: record.fromUser,
    id: record.id,
    messageTemplate: record.messageTemplate,
    teamId: record.teamId,
    toUser: record.toUser,
    type: record.type,
  };
}

function toSettings(input: {
  buddyUserId: string;
  dailyLimit?: number;
  enabled?: boolean;
  quietRanges?: Array<{ end: string; start: string }>;
  teamId: string;
  userId: string;
}): BuddyNudgeSettings {
  return {
    buddyUserId: input.buddyUserId,
    dailyLimit: (input.dailyLimit ?? defaultDailyLimit) as BuddyNudgeDailyLimit,
    enabled: input.enabled ?? true,
    quietRanges: input.quietRanges ?? [],
    teamId: input.teamId,
    userId: input.userId,
  };
}

function todayStartUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function assertCanNudge(input: {
  currentUser: CurrentUser;
  settings: BuddyNudgeSettings;
  team: Team;
  toUserId: string;
  todayCount: number;
}) {
  if (input.currentUser.id === input.toUserId) {
    throw new ApiError(400, 'bad_request', '不能戳自己。');
  }

  const fromMember = input.team.members.find((member) => member.user.id === input.currentUser.id);
  const toMember = input.team.members.find((member) => member.user.id === input.toUserId);

  if (!fromMember || !toMember) {
    throw new ApiError(403, 'forbidden', '只能提醒同一个小队里的搭子。');
  }

  if (fromMember.status !== 'active' || toMember.status !== 'active') {
    throw new ApiError(403, 'forbidden', '搭子暂时不接收提醒。');
  }

  if (!input.settings.enabled || input.settings.dailyLimit === 0) {
    throw new ApiError(403, 'forbidden', '这个搭子暂时关闭了主动提醒。');
  }

  if (isInQuietRanges(input.settings.quietRanges)) {
    throw new ApiError(403, 'forbidden', '现在是搭子的免打扰时间。');
  }

  if (input.todayCount >= input.settings.dailyLimit) {
    throw new ApiError(429, 'rate_limited', '今天已经轻轻戳够了，明天再来。');
  }
}

function requireCurrentTeam(team: Team | null): Team {
  if (!team) {
    throw new ApiError(404, 'not_found', '还没有小队。');
  }

  return team;
}

function requireBuddyMember(team: Team, currentUser: CurrentUser, buddyUserId: string) {
  const currentMember = team.members.find((member) => member.user.id === currentUser.id);
  const buddyMember = team.members.find((member) => member.user.id === buddyUserId);

  if (!currentMember || !buddyMember || currentUser.id === buddyUserId) {
    throw new ApiError(404, 'not_found', '没有找到这个搭子。');
  }

  return buddyMember;
}

async function notifySafely(
  pushNotificationService: PushNotificationService,
  payload: Parameters<PushNotificationService['sendToUser']>[0],
) {
  try {
    await pushNotificationService.sendToUser(payload);
  } catch {
    // Push delivery should not make the core nudge flow fail.
  }
}

export function createMockNudgeService(options: {
  pushNotificationService?: PushNotificationService;
  teamService: TeamService;
}): NudgeService {
  const pushNotificationService = options.pushNotificationService ?? createNoopPushNotificationService();
  const nudges = new Map<string, NudgeRecord>();
  const settingsByUserBuddy = new Map<string, BuddyNudgeSettings>();
  let nudgeSeq = 1;

  function settingKey(teamId: string, userId: string, buddyUserId: string) {
    return `${teamId}:${userId}:${buddyUserId}`;
  }

  function getExplicitSettings(teamId: string, userId: string, buddyUserId: string) {
    return settingsByUserBuddy.get(settingKey(teamId, userId, buddyUserId));
  }

  async function getTeam(currentUser: CurrentUser) {
    const response = await options.teamService.getCurrentTeam(currentUser);
    return requireCurrentTeam(response.team);
  }

  return {
    async ackNudge(currentUser, nudgeId, status) {
      const nudge = nudges.get(nudgeId);

      if (!nudge) {
        throw new ApiError(404, 'not_found', '没有找到这条提醒。');
      }

      if (nudge.toUser.id !== currentUser.id) {
        throw new ApiError(403, 'forbidden', '只能回复发给自己的提醒。');
      }

      const now = new Date();

      if (!nudge.ack) {
        nudge.ack = toAck({
          createdAt: now,
          revisionCount: 0,
          status,
          updatedAt: now,
        });
        await notifySafely(pushNotificationService, {
          body: ackNotificationMessages[status],
          data: {
            kind: 'buddy-nudge-ack',
            nudgeId,
            status,
          },
          title: '搭子有回音了',
          userId: nudge.fromUser.id,
        });

        return { ack: nudge.ack };
      }

      const ackCreatedAt = new Date(nudge.ack.createdAt);

      if (nudge.ack.revisionCount >= 1 || now.getTime() - ackCreatedAt.getTime() > ackRevisionWindowMs) {
        throw new ApiError(409, 'conflict', '这条回执已经不能修改了。');
      }

      nudge.ack = toAck({
        createdAt: ackCreatedAt,
        revisionCount: 1,
        status,
        updatedAt: now,
      });
      await notifySafely(pushNotificationService, {
        body: ackNotificationMessages[status],
        data: {
          kind: 'buddy-nudge-ack',
          nudgeId,
          status,
        },
        title: '搭子有回音了',
        userId: nudge.fromUser.id,
      });

      return { ack: nudge.ack };
    },
    async createNudge(currentUser, input) {
      const team = await getTeam(currentUser);
      const toMember = team.members.find((member) => member.user.id === input.toUserId);

      if (!toMember) {
        throw new ApiError(403, 'forbidden', '只能提醒同一个小队里的搭子。');
      }

      const settings =
        getExplicitSettings(team.id, input.toUserId, currentUser.id) ??
        toSettings({
          buddyUserId: currentUser.id,
          teamId: team.id,
          userId: input.toUserId,
        });
      const todayCount = [...nudges.values()].filter(
        (nudge) =>
          nudge.fromUser.id === currentUser.id &&
          nudge.toUser.id === input.toUserId &&
          nudge.createdAt >= todayStartUtc(),
      ).length;

      assertCanNudge({
        currentUser,
        settings,
        team,
        toUserId: input.toUserId,
        todayCount,
      });

      const now = new Date();
      const nudge = toNudge({
        ack: null,
        createdAt: now,
        expiresAt: new Date(now.getTime() + nudgeTtlMs),
        fromUser: currentUser,
        id: `mock-nudge-${nudgeSeq++}`,
        messageTemplate: nudgeMessages[input.type],
        teamId: team.id,
        toUser: toMember.user,
        type: input.type,
      });

      nudges.set(nudge.id, {
        ...nudge,
        createdAt: new Date(nudge.createdAt),
        expiresAt: new Date(nudge.expiresAt),
      });
      await notifySafely(pushNotificationService, {
        body: nudge.messageTemplate,
        data: {
          kind: 'buddy-nudge',
          nudgeId: nudge.id,
          teamId: nudge.teamId,
          type: nudge.type,
        },
        title: '搭子轻轻戳了你一下',
        userId: nudge.toUser.id,
      });

      return nudge;
    },
    async getSettings(currentUser) {
      const team = await getTeam(currentUser);

      return {
        settings: team.members
          .filter((member) => member.user.id !== currentUser.id && member.status !== 'removed')
          .map((member) =>
            toSettings({
              ...getExplicitSettings(team.id, currentUser.id, member.user.id),
              buddyUserId: member.user.id,
              teamId: team.id,
              userId: currentUser.id,
            }),
          ),
      };
    },
    async listInbox(currentUser) {
      return {
        nudges: [...nudges.values()]
          .filter((nudge) => nudge.toUser.id === currentUser.id)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .map(toNudge),
      };
    },
    async listSent(currentUser) {
      return {
        nudges: [...nudges.values()]
          .filter((nudge) => nudge.fromUser.id === currentUser.id)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .map(toNudge),
      };
    },
    async updateSettings(currentUser, buddyUserId, input) {
      const team = await getTeam(currentUser);
      const buddy = requireBuddyMember(team, currentUser, buddyUserId);
      const settings = toSettings({
        ...input,
        buddyUserId: buddy.user.id,
        teamId: team.id,
        userId: currentUser.id,
      });

      settingsByUserBuddy.set(settingKey(team.id, currentUser.id, buddy.user.id), settings);

      return {
        settings: [settings],
      };
    },
  };
}

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
      .where(
        and(
          eq(teamMembers.userId, currentUser.id),
          eq(teamMembers.status, 'active'),
          isNull(teams.archivedAt),
        ),
      )
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
        avatarUrl: row.avatarUrl,
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

  async function findUserSummary(userId: string) {
    const [user] = await db
      .select({
        avatarUrl: users.avatarUrl,
        id: users.id,
        nickname: users.nickname,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new ApiError(404, 'not_found', '没有找到这个用户。');
    }

    return user;
  }

  async function getNudgeRecord(nudgeId: string) {
    const [nudge] = await db.select().from(buddyNudges).where(eq(buddyNudges.id, nudgeId)).limit(1);

    if (!nudge) {
      throw new ApiError(404, 'not_found', '没有找到这条提醒。');
    }

    const [ack] = await db.select().from(buddyNudgeAcks).where(eq(buddyNudgeAcks.nudgeId, nudge.id)).limit(1);

    return toNudge({
      ack: ack ? toAck(ack) : null,
      createdAt: nudge.createdAt,
      expiresAt: nudge.expiresAt,
      fromUser: await findUserSummary(nudge.fromUserId),
      id: nudge.id,
      messageTemplate: nudge.messageTemplate,
      teamId: nudge.teamId,
      toUser: await findUserSummary(nudge.toUserId),
      type: nudge.type,
    });
  }

  async function listNudgesBy(field: 'from' | 'to', userId: string) {
    const rows = await db
      .select()
      .from(buddyNudges)
      .where(eq(field === 'from' ? buddyNudges.fromUserId : buddyNudges.toUserId, userId))
      .orderBy(desc(buddyNudges.createdAt))
      .limit(50);

    return {
      nudges: await Promise.all(rows.map((row) => getNudgeRecord(row.id))),
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

      const [existingAck] = await db
        .select()
        .from(buddyNudgeAcks)
        .where(and(eq(buddyNudgeAcks.nudgeId, nudgeId), eq(buddyNudgeAcks.userId, currentUser.id)))
        .limit(1);
      const now = new Date();

      if (!existingAck) {
        const [ack] = await db
          .insert(buddyNudgeAcks)
          .values({
            nudgeId,
            status,
            userId: currentUser.id,
          })
          .returning();

        if (!ack) {
          throw new Error('Failed to create nudge ack.');
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

        return { ack: toAck(ack) };
      }

      if (
        existingAck.revisionCount >= 1 ||
        now.getTime() - existingAck.createdAt.getTime() > ackRevisionWindowMs
      ) {
        throw new ApiError(409, 'conflict', '这条回执已经不能修改了。');
      }

      const [updatedAck] = await db
        .update(buddyNudgeAcks)
        .set({
          revisionCount: 1,
          status,
          updatedAt: now,
        })
        .where(eq(buddyNudgeAcks.id, existingAck.id))
        .returning();

      if (!updatedAck) {
        throw new Error('Failed to update nudge ack.');
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
      const todayRows = await db
        .select({ id: buddyNudges.id })
        .from(buddyNudges)
        .where(
          and(
            eq(buddyNudges.fromUserId, currentUser.id),
            eq(buddyNudges.toUserId, input.toUserId),
            gte(buddyNudges.createdAt, todayStartUtc()),
          ),
        );

      assertCanNudge({
        currentUser,
        settings,
        team,
        toUserId: input.toUserId,
        todayCount: todayRows.length,
      });

      const now = new Date();
      const [nudge] = await db
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

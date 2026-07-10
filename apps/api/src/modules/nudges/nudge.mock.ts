import type {
  BuddyNudgeSettings,
} from '@xiaotidu/contracts';

import { ApiError } from '../../http/apiError.js';
import {
  createNoopPushNotificationService,
  type PushNotificationService,
} from '../push/pushNotificationService.js';
import type { TeamService } from '../teams/teamService.js';
import type { CurrentUser } from '../users/userTypes.js';
import {
  toAck,
  toNudge,
  toSettings,
} from './nudge.mapper.js';
import {
  ackNotificationMessages,
  ackRevisionWindowMs,
  assertCanNudge,
  defaultTimezone,
  notifySafely,
  nudgeMessages,
  nudgeTtlMs,
  requireBuddyMember,
  requireCurrentTeam,
  todayStartInTimezone,
} from './nudge.policy.js';
import type { NudgeRecord } from './nudge.types.js';
import type { NudgeService } from './nudgeService.js';

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
          nudge.createdAt >= todayStartInTimezone(defaultTimezone),
      ).length;

      assertCanNudge({
        currentUser,
        recipientTimezone: defaultTimezone,
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
    async listThread(currentUser, buddyUserId, options) {
      const team = await getTeam(currentUser);
      requireBuddyMember(team, currentUser, buddyUserId);
      const threadNudges = [...nudges.values()]
        .filter((nudge) => {
          const isThreadNudge =
            nudge.teamId === team.id &&
            ((nudge.fromUser.id === currentUser.id && nudge.toUser.id === buddyUserId) ||
              (nudge.fromUser.id === buddyUserId && nudge.toUser.id === currentUser.id));

          if (!isThreadNudge) {
            return false;
          }

          return options.before ? nudge.createdAt < options.before : true;
        })
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      const page = threadNudges.slice(0, options.limit);
      const hasMore = threadNudges.length > options.limit;

      return {
        hasMore,
        nextCursor: hasMore ? page.at(-1)?.createdAt.toISOString() ?? null : null,
        nudges: page.map(toNudge),
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

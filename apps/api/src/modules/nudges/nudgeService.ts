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
import { ApiError } from '../../http/apiError.js';
import { createNoopPushNotificationService, type PushNotificationService } from '../push/pushNotificationService.js';
import type { CurrentUser } from '../users/userTypes.js';
import { toNudgeThreadSummaries, toSettings } from './nudge.mapper.js';
import {
  ackNotificationMessages,
  ackRevisionWindowMs,
  assertAckCanBeRevised,
  assertCanAcknowledge,
  assertCanNudge,
  assertDailyNudgeCountWithinLimit,
  defaultTimezone,
  notifySafely,
  nudgeMessages,
  nudgeTtlMs,
  requireBuddyMember,
  todayDateKeyInTimezone,
} from './nudge.policy.js';
import { createDrizzleNudgeRepository, type NudgeRepository } from './nudge.repository.js';

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

export function createNudgeService(
  repository: NudgeRepository,
  options: { pushNotificationService?: PushNotificationService } = {},
): NudgeService {
  const pushNotificationService = options.pushNotificationService ?? createNoopPushNotificationService();

  async function getTeamForNudge(currentUser: CurrentUser): Promise<Team> {
    const team = await repository.findCurrentTeam(currentUser.id);

    if (!team) {
      throw new ApiError(404, 'not_found', '还没有小队。');
    }

    const members = await repository.listTeamMembers(team.id);
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

  async function getNudgeOrThrow(nudgeId: string) {
    const nudge = await repository.findNudge(nudgeId);
    if (!nudge) {
      throw new ApiError(404, 'not_found', '没有找到这条提醒。');
    }
    return nudge;
  }

  async function notifyAck(nudge: BuddyNudge, status: BuddyNudgeAckStatus) {
    await notifySafely(pushNotificationService, {
      body: ackNotificationMessages[status],
      data: { kind: 'buddy-nudge-ack', nudgeId: nudge.id, status },
      title: '搭子有回音了',
      userId: nudge.fromUser.id,
    });
  }

  return {
    async ackNudge(currentUser, nudgeId, status) {
      const nudge = await getNudgeOrThrow(nudgeId);
      assertCanAcknowledge(nudge, currentUser);
      const createdAck = await repository.createAck(nudgeId, currentUser.id, status);

      if (createdAck) {
        await notifyAck(nudge, status);
        return { ack: createdAck };
      }

      const now = new Date();
      const existingAck = nudge.ack ?? (await repository.findAck(nudgeId, currentUser.id));
      assertAckCanBeRevised(existingAck, now);
      const updatedAck = await repository.reviseAck(
        nudgeId,
        currentUser.id,
        status,
        now,
        new Date(now.getTime() - ackRevisionWindowMs),
      );

      if (!updatedAck) {
        throw new ApiError(409, 'conflict', '这条回执已经不能修改了。');
      }

      await notifyAck(nudge, status);
      return { ack: updatedAck };
    },
    async createNudge(currentUser, input) {
      const team = await getTeamForNudge(currentUser);
      const settings =
        (await repository.findSettings(team.id, input.toUserId, currentUser.id)) ??
        toSettings({ buddyUserId: currentUser.id, teamId: team.id, userId: input.toUserId });
      const recipientTimezone = (await repository.findUserTimezone(input.toUserId)) ?? defaultTimezone;
      assertCanNudge({
        currentUser,
        recipientTimezone,
        settings,
        team,
        toUserId: input.toUserId,
        todayCount: 0,
      });

      const now = new Date();
      const created = await repository.withTransaction(async (transaction) => {
        const count = await transaction.incrementDailyCounter(
          currentUser.id,
          input.toUserId,
          todayDateKeyInTimezone(recipientTimezone, now),
          now,
        );
        assertDailyNudgeCountWithinLimit(count, settings.dailyLimit);
        return transaction.createNudge({
          expiresAt: new Date(now.getTime() + nudgeTtlMs),
          fromUserId: currentUser.id,
          messageTemplate: nudgeMessages[input.type],
          teamId: team.id,
          toUserId: input.toUserId,
          type: input.type,
        });
      });

      await notifySafely(pushNotificationService, {
        body: created.messageTemplate,
        data: { kind: 'buddy-nudge', nudgeId: created.id, teamId: created.teamId, type: created.type },
        title: '搭子轻轻戳了你一下',
        userId: created.toUserId,
      });
      return getNudgeOrThrow(created.id);
    },
    async getSettings(currentUser) {
      const team = await getTeamForNudge(currentUser);
      const members = team.members.filter((member) => member.user.id !== currentUser.id && member.status !== 'removed');
      const explicitSettings = await repository.listSettings(team.id, currentUser.id);
      const settingsByBuddyUserId = new Map(explicitSettings.map((settings) => [settings.buddyUserId, settings]));

      return {
        settings: members.map(
          (member) =>
            settingsByBuddyUserId.get(member.user.id) ??
            toSettings({ buddyUserId: member.user.id, teamId: team.id, userId: currentUser.id }),
        ),
      };
    },
    async listInbox(currentUser) {
      return { nudges: await repository.listNudgesByUser('to', currentUser.id, 50) };
    },
    async listSent(currentUser) {
      return { nudges: await repository.listNudgesByUser('from', currentUser.id, 50) };
    },
    async listThreads(currentUser) {
      const team = await getTeamForNudge(currentUser);
      const nudges = await repository.listTeamNudges(team.id, currentUser.id, 200);
      return { threads: toNudgeThreadSummaries(currentUser.id, team.members, nudges) };
    },
    async listThread(currentUser, buddyUserId, threadOptions) {
      const team = await getTeamForNudge(currentUser);
      requireBuddyMember(team, currentUser, buddyUserId);
      const rows = await repository.listThreadNudges({
        before: threadOptions.before,
        buddyUserId,
        limit: threadOptions.limit + 1,
        teamId: team.id,
        userId: currentUser.id,
      });
      const page = rows.slice(0, threadOptions.limit);
      const hasMore = rows.length > threadOptions.limit;
      return {
        hasMore,
        nextCursor: hasMore ? (page.at(-1)?.createdAt ?? null) : null,
        nudges: page,
      };
    },
    async updateSettings(currentUser, buddyUserId, input) {
      const team = await getTeamForNudge(currentUser);
      requireBuddyMember(team, currentUser, buddyUserId);
      return {
        settings: [await repository.upsertSettings(team.id, currentUser.id, buddyUserId, input)],
      };
    },
  };
}

export function createDrizzleNudgeService(
  db: Database,
  options: { pushNotificationService?: PushNotificationService } = {},
): NudgeService {
  return createNudgeService(createDrizzleNudgeRepository(db), options);
}

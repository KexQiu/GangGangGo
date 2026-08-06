import { and, eq, or } from 'drizzle-orm';

import type { AccountDataExport } from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import {
  auditEvents,
  authSessions,
  dailyActivitySummaries,
  dailyReportSnapshots,
  dataSyncChanges,
  friendEventAcks,
  friendEvents,
  friendInvites,
  friendNudgeDailyCounters,
  friendSettings,
  friendships,
  growthEvents,
  pushTokens,
  subscriptionEvents,
  subscriptions,
  syncedHabitCheckIns,
  syncedToiletSessions,
  syncedToiletSignalPresets,
  syncedTrainingSessions,
  users,
} from '../../db/schema.js';
import type { CurrentUser } from './userTypes.js';
import type { UserRepository } from './userRepository.js';
import { toUserProfile } from './users.mapper.js';

export type AccountDataService = {
  deleteAccount: (userId: string) => Promise<void>;
  exportAccountData: (user: CurrentUser) => Promise<AccountDataExport>;
};

function createEmptyExport(user: CurrentUser): AccountDataExport {
  return {
    data: {
      auditEvents: [],
      dailyActivitySummaries: [],
      dailyReportSnapshots: [],
      dataSyncChanges: [],
      friendEventAcks: [],
      friendEvents: [],
      friendInvites: [],
      friendNudgeDailyCounters: [],
      friendSettings: [],
      friendships: [],
      growthEvents: [],
      habitCheckIns: [],
      pushRegistrations: [],
      sessions: [],
      subscriptionEvents: [],
      subscriptions: [],
      toiletSessions: [],
      toiletSignalPresets: [],
      trainingSessions: [],
    },
    exportedAt: new Date().toISOString(),
    profile: toUserProfile(user),
    version: 1,
  };
}

export function createMockAccountDataService(userRepository: UserRepository): AccountDataService {
  return {
    async deleteAccount(userId) {
      await userRepository.deleteById(userId);
    },
    async exportAccountData(user) {
      return createEmptyExport(user);
    },
  };
}

export function createDrizzleAccountDataService(db: Database): AccountDataService {
  return {
    async deleteAccount(userId) {
      await db.transaction(async (transaction) => {
        await transaction.delete(subscriptionEvents).where(eq(subscriptionEvents.userId, userId));
        await transaction.delete(growthEvents).where(eq(growthEvents.userId, userId));
        await transaction
          .delete(auditEvents)
          .where(
            or(
              eq(auditEvents.userId, userId),
              and(eq(auditEvents.targetType, 'user'), eq(auditEvents.targetId, userId)),
            ),
          );
        await transaction
          .delete(friendInvites)
          .where(or(eq(friendInvites.inviterUserId, userId), eq(friendInvites.acceptedByUserId, userId)));
        await transaction.delete(users).where(eq(users.id, userId));
      });
    },
    async exportAccountData(user) {
      const userId = user.id;
      const [
        trainingSessions,
        habitCheckIns,
        toiletSessions,
        toiletSignalPresets,
        userDailyActivitySummaries,
        userDailyReportSnapshots,
        userDataSyncChanges,
        userGrowthEvents,
        userFriendships,
        userFriendSettings,
        userFriendInvites,
        userFriendEvents,
        userFriendEventAcks,
        userFriendNudgeDailyCounters,
        userSubscriptions,
        userSubscriptionEvents,
        userPushRegistrations,
        userSessions,
        userAuditEvents,
      ] = await Promise.all([
        db.select().from(syncedTrainingSessions).where(eq(syncedTrainingSessions.userId, userId)),
        db.select().from(syncedHabitCheckIns).where(eq(syncedHabitCheckIns.userId, userId)),
        db.select().from(syncedToiletSessions).where(eq(syncedToiletSessions.userId, userId)),
        db.select().from(syncedToiletSignalPresets).where(eq(syncedToiletSignalPresets.userId, userId)),
        db.select().from(dailyActivitySummaries).where(eq(dailyActivitySummaries.userId, userId)),
        db.select().from(dailyReportSnapshots).where(eq(dailyReportSnapshots.userId, userId)),
        db.select().from(dataSyncChanges).where(eq(dataSyncChanges.userId, userId)),
        db.select().from(growthEvents).where(eq(growthEvents.userId, userId)),
        db
          .select()
          .from(friendships)
          .where(or(eq(friendships.lowerUserId, userId), eq(friendships.upperUserId, userId))),
        db.select().from(friendSettings).where(eq(friendSettings.userId, userId)),
        db
          .select()
          .from(friendInvites)
          .where(or(eq(friendInvites.inviterUserId, userId), eq(friendInvites.acceptedByUserId, userId))),
        db
          .select()
          .from(friendEvents)
          .where(or(eq(friendEvents.fromUserId, userId), eq(friendEvents.toUserId, userId))),
        db.select().from(friendEventAcks).where(eq(friendEventAcks.userId, userId)),
        db
          .select()
          .from(friendNudgeDailyCounters)
          .where(or(eq(friendNudgeDailyCounters.fromUserId, userId), eq(friendNudgeDailyCounters.toUserId, userId))),
        db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
        db.select().from(subscriptionEvents).where(eq(subscriptionEvents.userId, userId)),
        db
          .select({
            createdAt: pushTokens.createdAt,
            deviceId: pushTokens.deviceId,
            enabled: pushTokens.enabled,
            id: pushTokens.id,
            lastSeenAt: pushTokens.lastSeenAt,
            platform: pushTokens.platform,
            provider: pushTokens.provider,
            updatedAt: pushTokens.updatedAt,
          })
          .from(pushTokens)
          .where(eq(pushTokens.userId, userId)),
        db
          .select({
            createdAt: authSessions.createdAt,
            expiresAt: authSessions.expiresAt,
            id: authSessions.id,
            revokedAt: authSessions.revokedAt,
            updatedAt: authSessions.updatedAt,
          })
          .from(authSessions)
          .where(eq(authSessions.userId, userId)),
        db.select().from(auditEvents).where(eq(auditEvents.userId, userId)),
      ]);

      return {
        data: {
          auditEvents: userAuditEvents,
          dailyActivitySummaries: userDailyActivitySummaries,
          dailyReportSnapshots: userDailyReportSnapshots,
          dataSyncChanges: userDataSyncChanges,
          friendEventAcks: userFriendEventAcks,
          friendEvents: userFriendEvents,
          friendInvites: userFriendInvites,
          friendNudgeDailyCounters: userFriendNudgeDailyCounters,
          friendSettings: userFriendSettings,
          friendships: userFriendships,
          growthEvents: userGrowthEvents,
          habitCheckIns,
          pushRegistrations: userPushRegistrations,
          sessions: userSessions,
          subscriptionEvents: userSubscriptionEvents,
          subscriptions: userSubscriptions,
          toiletSessions,
          toiletSignalPresets,
          trainingSessions,
        },
        exportedAt: new Date().toISOString(),
        profile: toUserProfile(user),
        version: 1,
      };
    },
  };
}

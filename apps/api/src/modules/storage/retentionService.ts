import { and, isNotNull, lt, or } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  authSessions,
  dailyReportSnapshots,
  friendEvents,
  friendInvites,
  friendNudgeDailyCounters,
  growthEvents,
} from '../../db/schema.js';
import { purgeExpiredSyncedData } from '../dataSync/dataSyncService.js';

const dayMs = 24 * 60 * 60 * 1000;
export const growthEventRetentionDays = 90;
export const friendCounterRetentionDays = 90;
export const friendEventRetentionDays = 90;
export const reportSnapshotRetentionDays = 90;

export type RetentionPurgeResult = {
  authSessions: number;
  friendEvents: number;
  friendInvites: number;
  friendNudgeDailyCounters: number;
  growthEvents: number;
  reportSnapshots: number;
  syncedDataTables: number;
};

export async function purgeExpiredData(db: Database, now = new Date()): Promise<RetentionPurgeResult> {
  const growthCutoff = new Date(now.getTime() - growthEventRetentionDays * dayMs);
  const counterCutoff = new Date(now.getTime() - friendCounterRetentionDays * dayMs).toISOString().slice(0, 10);
  const friendEventCutoff = new Date(now.getTime() - friendEventRetentionDays * dayMs);
  const reportSnapshotCutoff = new Date(now.getTime() - reportSnapshotRetentionDays * dayMs).toISOString().slice(0, 10);
  const syncedDataTables = await purgeExpiredSyncedData(db, now);

  const result = await db.transaction(async (transaction) => {
    const [
      deletedAuthSessions,
      deletedFriendEvents,
      deletedFriendInvites,
      deletedCounters,
      deletedGrowthEvents,
      deletedReportSnapshots,
    ] = await Promise.all([
      transaction
        .delete(authSessions)
        .where(
          or(lt(authSessions.expiresAt, now), and(isNotNull(authSessions.revokedAt), lt(authSessions.revokedAt, now))),
        )
        .returning({ id: authSessions.id }),
      transaction
        .delete(friendEvents)
        .where(
          or(
            and(isNotNull(friendEvents.expiresAt), lt(friendEvents.expiresAt, now)),
            lt(friendEvents.occurredAt, friendEventCutoff),
          ),
        )
        .returning({ id: friendEvents.id }),
      transaction.delete(friendInvites).where(lt(friendInvites.expiresAt, now)).returning({ id: friendInvites.id }),
      transaction
        .delete(friendNudgeDailyCounters)
        .where(lt(friendNudgeDailyCounters.localDate, counterCutoff))
        .returning({ id: friendNudgeDailyCounters.id }),
      transaction
        .delete(growthEvents)
        .where(lt(growthEvents.receivedAt, growthCutoff))
        .returning({ id: growthEvents.id }),
      transaction
        .delete(dailyReportSnapshots)
        .where(lt(dailyReportSnapshots.date, reportSnapshotCutoff))
        .returning({ id: dailyReportSnapshots.id }),
    ]);

    return {
      authSessions: deletedAuthSessions.length,
      friendEvents: deletedFriendEvents.length,
      friendInvites: deletedFriendInvites.length,
      friendNudgeDailyCounters: deletedCounters.length,
      growthEvents: deletedGrowthEvents.length,
      reportSnapshots: deletedReportSnapshots.length,
    };
  });

  return { ...result, syncedDataTables };
}

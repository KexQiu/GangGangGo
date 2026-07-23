import { and, asc, eq, gt, isNull, lt, min } from 'drizzle-orm';

import {
  habitCheckInSyncPayloadSchema,
  toiletSessionSyncPayloadSchema,
  toiletSignalPresetSyncPayloadSchema,
  trainingSessionSyncPayloadSchema,
  type DataSyncChange,
  type DataSyncEntityType,
  type DataSyncMutation,
  type DataSyncPullResponse,
  type DataSyncPushResponse,
  type DailyActivitySummary,
} from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import {
  dailyActivitySummaries,
  dataSyncChanges,
  syncedHabitCheckIns,
  syncedToiletSessions,
  syncedToiletSignalPresets,
  syncedTrainingSessions,
} from '../../db/schema.js';
import type { CurrentUser } from '../users/userTypes.js';
import type { FriendService, ToiletFinishedSyncEvent } from '../friends/friendService.js';

const pullPageSize = 250;
const retentionDays = 90;

export type DataSyncService = {
  pull: (currentUser: CurrentUser, cursor: string) => Promise<DataSyncPullResponse>;
  push: (currentUser: CurrentUser, mutations: DataSyncMutation[], timeZone: string) => Promise<DataSyncPushResponse>;
};

export function createDrizzleDataSyncService(
  db: Database,
  options: { friendService?: FriendService } = {},
): DataSyncService {
  return {
    async pull(currentUser, cursor) {
      const parsedCursor = parseCursor(cursor);
      const [minimumRow] = await db
        .select({ version: min(dataSyncChanges.version) })
        .from(dataSyncChanges)
        .where(eq(dataSyncChanges.userId, currentUser.id));
      const minimumVersion = minimumRow?.version ?? null;
      const resetRequired = parsedCursor > 0 && minimumVersion !== null && parsedCursor < minimumVersion - 1;
      const effectiveCursor = resetRequired ? 0 : parsedCursor;
      const rows = await db
        .select()
        .from(dataSyncChanges)
        .where(and(eq(dataSyncChanges.userId, currentUser.id), gt(dataSyncChanges.version, effectiveCursor)))
        .orderBy(asc(dataSyncChanges.version))
        .limit(pullPageSize + 1);
      const page = rows.slice(0, pullPageSize);

      return {
        changes: page.map(rowToChange),
        hasMore: rows.length > pullPageSize,
        nextCursor: String(page.at(-1)?.version ?? effectiveCursor),
        resetRequired,
      };
    },
    async push(currentUser, mutations, timeZone) {
      const toiletEvents: ToiletFinishedSyncEvent[] = [];
      const response = await db.transaction(async (transaction) => {
        const acceptedAt = new Date();
        const acceptedMutationIds: string[] = [];
        const changes: DataSyncChange[] = [];
        const affectedDates = new Set<string>();

        for (const mutation of mutations) {
          const localDate = await getMutationLocalDate(transaction, currentUser.id, mutation);
          const expiresAt = localDate
            ? expirationForLocalDate(localDate, timeZone)
            : mutation.entityType === 'toilet_signal_preset' && mutation.operation === 'upsert'
              ? null
              : new Date(acceptedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
          if (expiresAt && expiresAt <= acceptedAt) {
            acceptedMutationIds.push(mutation.mutationId);
            continue;
          }
          const [insertedChange] = await transaction
            .insert(dataSyncChanges)
            .values({
              entityId: mutation.entityId,
              entityType: mutation.entityType,
              expiresAt,
              mutationId: mutation.mutationId,
              operation: mutation.operation,
              payload: mutation.payload,
              userId: currentUser.id,
            })
            .onConflictDoNothing({ target: [dataSyncChanges.userId, dataSyncChanges.mutationId] })
            .returning();
          const changeRow =
            insertedChange ??
            (
              await transaction
                .select()
                .from(dataSyncChanges)
                .where(
                  and(eq(dataSyncChanges.userId, currentUser.id), eq(dataSyncChanges.mutationId, mutation.mutationId)),
                )
                .limit(1)
            )[0];
          if (!changeRow) throw new Error('Failed to append data sync change.');

          if (changeRow.entityType === 'toilet_session' && changeRow.operation === 'upsert') {
            const payload = toiletSessionSyncPayloadSchema.parse(changeRow.payload);
            toiletEvents.push({
              durationSeconds: payload.durationSeconds,
              endedAt: payload.endedAt,
              sourceEntityId: changeRow.entityId,
            });
          }

          if (!insertedChange) {
            acceptedMutationIds.push(mutation.mutationId);
            changes.push(rowToChange(changeRow));
            continue;
          }

          await applyMutation(transaction, currentUser.id, mutation, changeRow.version, expiresAt);
          if (mutation.entityType === 'toilet_signal_preset' && mutation.operation === 'delete') {
            await transaction
              .update(dataSyncChanges)
              .set({ expiresAt })
              .where(
                and(
                  eq(dataSyncChanges.userId, currentUser.id),
                  eq(dataSyncChanges.entityType, mutation.entityType),
                  eq(dataSyncChanges.entityId, mutation.entityId),
                ),
              );
          }
          if (localDate) affectedDates.add(localDate);
          acceptedMutationIds.push(mutation.mutationId);
          changes.push(rowToChange(changeRow));
        }

        for (const date of affectedDates) {
          await rebuildDailySummary(transaction, currentUser.id, date, timeZone);
        }

        return { acceptedMutationIds, changes };
      });
      if (options.friendService && toiletEvents.length) {
        await Promise.all(toiletEvents.map((event) => options.friendService!.recordToiletFinished(currentUser, event)));
      }
      return response;
    },
  };
}

export function createMockDataSyncService(options: { friendService?: FriendService } = {}): DataSyncService {
  const changesByUser = new Map<string, DataSyncChange[]>();
  const mutationChangesByUser = new Map<string, Map<string, DataSyncChange>>();
  let version = 0;

  return {
    async pull(currentUser, cursor) {
      const parsedCursor = parseCursor(cursor);
      const all = changesByUser.get(currentUser.id) ?? [];
      const rows = all.filter((change) => change.version > parsedCursor).slice(0, pullPageSize + 1);
      const page = rows.slice(0, pullPageSize);
      return {
        changes: page,
        hasMore: rows.length > pullPageSize,
        nextCursor: String(page.at(-1)?.version ?? parsedCursor),
        resetRequired: false,
      };
    },
    async push(currentUser, mutations) {
      const accepted = mutationChangesByUser.get(currentUser.id) ?? new Map<string, DataSyncChange>();
      const userChanges = changesByUser.get(currentUser.id) ?? [];
      const responseChanges: DataSyncChange[] = [];
      const toiletEvents: ToiletFinishedSyncEvent[] = [];
      for (const mutation of mutations) {
        const existing = accepted.get(mutation.mutationId);
        if (existing) {
          responseChanges.push(existing);
          if (existing.entityType === 'toilet_session' && existing.operation === 'upsert') {
            const payload = toiletSessionSyncPayloadSchema.parse(existing.payload);
            toiletEvents.push({
              durationSeconds: payload.durationSeconds,
              endedAt: payload.endedAt,
              sourceEntityId: existing.entityId,
            });
          }
          continue;
        }
        version += 1;
        const change: DataSyncChange = {
          entityId: mutation.entityId,
          entityType: mutation.entityType,
          operation: mutation.operation,
          payload: mutation.payload,
          serverUpdatedAt: new Date().toISOString(),
          version,
        };
        accepted.set(mutation.mutationId, change);
        userChanges.push(change);
        responseChanges.push(change);
        if (mutation.entityType === 'toilet_session' && mutation.operation === 'upsert') {
          const payload = toiletSessionSyncPayloadSchema.parse(mutation.payload);
          toiletEvents.push({
            durationSeconds: payload.durationSeconds,
            endedAt: payload.endedAt,
            sourceEntityId: mutation.entityId,
          });
        }
      }
      mutationChangesByUser.set(currentUser.id, accepted);
      changesByUser.set(currentUser.id, userChanges);
      if (options.friendService) {
        await Promise.all(toiletEvents.map((event) => options.friendService!.recordToiletFinished(currentUser, event)));
      }
      return { acceptedMutationIds: mutations.map((mutation) => mutation.mutationId), changes: responseChanges };
    },
  };
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

async function applyMutation(
  transaction: Transaction,
  userId: string,
  mutation: DataSyncMutation,
  version: number,
  expiresAt: Date | null,
) {
  if (mutation.operation === 'delete') {
    const values = { deletedAt: new Date(), expiresAt, syncVersion: version, updatedAt: new Date() };
    if (mutation.entityType === 'training_session') {
      await transaction
        .update(syncedTrainingSessions)
        .set(values)
        .where(and(eq(syncedTrainingSessions.userId, userId), eq(syncedTrainingSessions.recordId, mutation.entityId)));
    } else if (mutation.entityType === 'habit_checkin') {
      await transaction
        .update(syncedHabitCheckIns)
        .set(values)
        .where(and(eq(syncedHabitCheckIns.userId, userId), eq(syncedHabitCheckIns.recordId, mutation.entityId)));
    } else if (mutation.entityType === 'toilet_session') {
      await transaction
        .update(syncedToiletSessions)
        .set(values)
        .where(and(eq(syncedToiletSessions.userId, userId), eq(syncedToiletSessions.recordId, mutation.entityId)));
    } else {
      await transaction
        .update(syncedToiletSignalPresets)
        .set(values)
        .where(
          and(eq(syncedToiletSignalPresets.userId, userId), eq(syncedToiletSignalPresets.recordId, mutation.entityId)),
        );
    }
    return;
  }

  const updatedAt = new Date();
  if (mutation.entityType === 'training_session') {
    const payload = trainingSessionSyncPayloadSchema.parse(mutation.payload);
    await transaction
      .insert(syncedTrainingSessions)
      .values({
        ...payload,
        endedAt: new Date(payload.endedAt),
        expiresAt,
        recordId: mutation.entityId,
        startedAt: new Date(payload.startedAt),
        syncVersion: version,
        userId,
      })
      .onConflictDoUpdate({
        target: [syncedTrainingSessions.userId, syncedTrainingSessions.recordId],
        set: {
          ...payload,
          deletedAt: null,
          endedAt: new Date(payload.endedAt),
          expiresAt,
          startedAt: new Date(payload.startedAt),
          syncVersion: version,
          updatedAt,
        },
      });
  } else if (mutation.entityType === 'habit_checkin') {
    const payload = habitCheckInSyncPayloadSchema.parse(mutation.payload);
    await transaction
      .insert(syncedHabitCheckIns)
      .values({
        ...payload,
        expiresAt,
        localDate: payload.date,
        recordId: mutation.entityId,
        syncVersion: version,
        userId,
      })
      .onConflictDoUpdate({
        target: [syncedHabitCheckIns.userId, syncedHabitCheckIns.recordId],
        set: { ...payload, deletedAt: null, expiresAt, localDate: payload.date, syncVersion: version, updatedAt },
      });
  } else if (mutation.entityType === 'toilet_session') {
    const payload = toiletSessionSyncPayloadSchema.parse(mutation.payload);
    await transaction
      .insert(syncedToiletSessions)
      .values({
        ...payload,
        endedAt: new Date(payload.endedAt),
        expiresAt,
        recordId: mutation.entityId,
        startedAt: new Date(payload.startedAt),
        syncVersion: version,
        userId,
      })
      .onConflictDoUpdate({
        target: [syncedToiletSessions.userId, syncedToiletSessions.recordId],
        set: {
          ...payload,
          deletedAt: null,
          endedAt: new Date(payload.endedAt),
          expiresAt,
          startedAt: new Date(payload.startedAt),
          syncVersion: version,
          updatedAt,
        },
      });
  } else {
    const payload = toiletSignalPresetSyncPayloadSchema.parse(mutation.payload);
    await transaction
      .insert(syncedToiletSignalPresets)
      .values({
        createdAt: new Date(payload.createdAt),
        expiresAt: null,
        label: payload.label,
        recordId: mutation.entityId,
        syncVersion: version,
        userId,
      })
      .onConflictDoUpdate({
        target: [syncedToiletSignalPresets.userId, syncedToiletSignalPresets.label],
        set: { deletedAt: null, recordId: mutation.entityId, syncVersion: version, updatedAt },
      });
  }
}

async function getMutationLocalDate(transaction: Transaction, userId: string, mutation: DataSyncMutation) {
  if (mutation.operation === 'upsert') {
    if (mutation.entityType === 'training_session')
      return trainingSessionSyncPayloadSchema.parse(mutation.payload).localDate;
    if (mutation.entityType === 'habit_checkin') return habitCheckInSyncPayloadSchema.parse(mutation.payload).date;
    if (mutation.entityType === 'toilet_session')
      return toiletSessionSyncPayloadSchema.parse(mutation.payload).localDate;
    return null;
  }

  if (mutation.entityType === 'training_session') {
    const [row] = await transaction
      .select({ localDate: syncedTrainingSessions.localDate })
      .from(syncedTrainingSessions)
      .where(and(eq(syncedTrainingSessions.userId, userId), eq(syncedTrainingSessions.recordId, mutation.entityId)))
      .limit(1);
    return row?.localDate ?? null;
  }
  if (mutation.entityType === 'habit_checkin') {
    const [row] = await transaction
      .select({ localDate: syncedHabitCheckIns.localDate })
      .from(syncedHabitCheckIns)
      .where(and(eq(syncedHabitCheckIns.userId, userId), eq(syncedHabitCheckIns.recordId, mutation.entityId)))
      .limit(1);
    return row?.localDate ?? null;
  }
  if (mutation.entityType === 'toilet_session') {
    const [row] = await transaction
      .select({ localDate: syncedToiletSessions.localDate })
      .from(syncedToiletSessions)
      .where(and(eq(syncedToiletSessions.userId, userId), eq(syncedToiletSessions.recordId, mutation.entityId)))
      .limit(1);
    return row?.localDate ?? null;
  }
  return null;
}

async function rebuildDailySummary(transaction: Transaction, userId: string, date: string, timeZone: string) {
  const [training, habits, toilets] = await Promise.all([
    transaction
      .select()
      .from(syncedTrainingSessions)
      .where(
        and(
          eq(syncedTrainingSessions.userId, userId),
          eq(syncedTrainingSessions.localDate, date),
          isNull(syncedTrainingSessions.deletedAt),
        ),
      ),
    transaction
      .select()
      .from(syncedHabitCheckIns)
      .where(
        and(
          eq(syncedHabitCheckIns.userId, userId),
          eq(syncedHabitCheckIns.localDate, date),
          isNull(syncedHabitCheckIns.deletedAt),
        ),
      )
      .limit(1),
    transaction
      .select()
      .from(syncedToiletSessions)
      .where(
        and(
          eq(syncedToiletSessions.userId, userId),
          eq(syncedToiletSessions.localDate, date),
          isNull(syncedToiletSessions.deletedAt),
        ),
      ),
  ]);
  const habit = habits[0];
  const summary = buildDailySummary(date, training, habit, toilets);
  const expiresAt = expirationForLocalDate(date, timeZone);
  await transaction
    .insert(dailyActivitySummaries)
    .values({ expiresAt, localDate: date, summary, userId })
    .onConflictDoUpdate({
      target: [dailyActivitySummaries.userId, dailyActivitySummaries.localDate],
      set: { expiresAt, summary, updatedAt: new Date() },
    });
}

function buildDailySummary(
  date: string,
  training: Array<typeof syncedTrainingSessions.$inferSelect>,
  habit: typeof syncedHabitCheckIns.$inferSelect | undefined,
  toilets: Array<typeof syncedToiletSessions.$inferSelect>,
): DailyActivitySummary {
  const durations = toilets.map((session) => session.durationSeconds).sort((left, right) => left - right);
  return {
    date,
    habit: {
      bowel: toHabitLevel(habit?.bowel),
      completionCount: [habit?.water, habit?.fiber, habit?.movement, habit?.bowel].filter(Boolean).length,
      fiber: toHabitLevel(habit?.fiber),
      movement: toHabitLevel(habit?.movement),
      water: toHabitLevel(habit?.water),
    },
    toilet: {
      attentionCount: toilets.filter(
        (session) =>
          session.bleeding || session.discomfort || session.stoolColor === 'attention' || session.signals.length > 0,
      ).length,
      colorCounts: countValues(toilets.map((session) => session.stoolColor)),
      feelingCounts: countValues(toilets.map((session) => session.feeling)),
      longSessionCount: toilets.filter((session) => session.durationSeconds >= 10 * 60).length,
      maxDurationSeconds: durations.at(-1) ?? 0,
      medianDurationSeconds: median(durations),
      sessionCount: toilets.length,
      shapeCounts: countValues(toilets.map((session) => session.stoolShape)),
      signalCounts: countValues(toilets.flatMap((session) => session.signals.map((signal) => signal.label))),
      totalDurationSeconds: durations.reduce((total, value) => total + value, 0),
    },
    training: {
      completedRepetitions: training.reduce((total, session) => total + session.completedRepetitions, 0),
      completedSessionCount: training.filter((session) => session.isCompleted).length,
      totalDurationSeconds: training.reduce((total, session) => total + session.durationSeconds, 0),
    },
  };
}

function rowToChange(row: typeof dataSyncChanges.$inferSelect): DataSyncChange {
  return {
    entityId: row.entityId,
    entityType: row.entityType as DataSyncEntityType,
    operation: row.operation as 'delete' | 'upsert',
    payload: row.payload,
    serverUpdatedAt: row.createdAt.toISOString(),
    version: row.version,
  };
}

function parseCursor(cursor: string) {
  const value = Number(cursor || '0');
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function expirationForLocalDate(date: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year!, month! - 1, day! + retentionDays, 0, 0, 0));
  return zonedDateTimeToUtc(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate(), timeZone);
}

function zonedDateTimeToUtc(year: number, month: number, day: number, timeZone: string) {
  let guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      second: '2-digit',
      timeZone,
      year: 'numeric',
    });
    for (let index = 0; index < 2; index += 1) {
      const values = Object.fromEntries(
        formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]),
      );
      const rendered = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second),
      );
      guess += Date.UTC(year, month - 1, day) - rendered;
    }
  } catch {
    // Unknown time zones safely fall back to UTC.
  }
  return new Date(guess);
}

function countValues(values: Array<string | null | undefined>) {
  const counts: Record<string, number> = {};
  for (const value of values) if (value) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? Math.round(((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2)
    : (values[middle] ?? 0);
}

function toHabitLevel(value: string | null | undefined): 'good' | 'low' | 'medium' | null {
  return value === 'good' || value === 'low' || value === 'medium' ? value : null;
}

export async function purgeExpiredSyncedData(db: Database, now = new Date()) {
  return db.transaction(async (transaction) => {
    const conditions = [
      lt(syncedTrainingSessions.expiresAt, now),
      lt(syncedHabitCheckIns.expiresAt, now),
      lt(syncedToiletSessions.expiresAt, now),
      lt(dailyActivitySummaries.expiresAt, now),
      lt(dataSyncChanges.expiresAt, now),
    ];
    const results = await Promise.all([
      transaction.delete(syncedTrainingSessions).where(conditions[0]!),
      transaction.delete(syncedHabitCheckIns).where(conditions[1]!),
      transaction.delete(syncedToiletSessions).where(conditions[2]!),
      transaction.delete(dailyActivitySummaries).where(conditions[3]!),
      transaction.delete(dataSyncChanges).where(conditions[4]!),
    ]);
    return results.length;
  });
}

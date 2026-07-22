import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { DataSyncPayload, DailyActivitySummary } from '@xiaotidu/contracts';

import { createdAt, updatedAt } from './common.js';
import { users } from './users.js';

const ownedRecord = {
  recordId: text('record_id').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
};

const syncMetadata = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  syncVersion: integer('sync_version').notNull().default(0),
  updatedAt,
};

export const syncedTrainingSessions = pgTable(
  'synced_training_sessions',
  {
    ...ownedRecord,
    completedRepetitions: integer('completed_repetitions').notNull(),
    discomfortReported: boolean('discomfort_reported').notNull().default(false),
    durationSeconds: integer('duration_seconds').notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    isCompleted: boolean('is_completed').notNull(),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    presetId: text('preset_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    ...syncMetadata,
    createdAt,
  },
  (table) => [
    uniqueIndex('synced_training_sessions_user_record_unique').on(table.userId, table.recordId),
    index('synced_training_sessions_user_date_idx').on(table.userId, table.localDate),
    index('synced_training_sessions_expires_idx').on(table.expiresAt),
    check('synced_training_sessions_duration_check', sql`${table.durationSeconds} >= 0`),
  ],
);

export const syncedHabitCheckIns = pgTable(
  'synced_habit_checkins',
  {
    ...ownedRecord,
    bowel: text('bowel'),
    fiber: text('fiber'),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    movement: text('movement'),
    water: text('water'),
    ...syncMetadata,
    createdAt,
  },
  (table) => [
    uniqueIndex('synced_habit_checkins_user_date_unique').on(table.userId, table.localDate),
    uniqueIndex('synced_habit_checkins_user_record_unique').on(table.userId, table.recordId),
    index('synced_habit_checkins_expires_idx').on(table.expiresAt),
  ],
);

export const syncedToiletSessions = pgTable(
  'synced_toilet_sessions',
  {
    ...ownedRecord,
    bleeding: boolean('bleeding').notNull().default(false),
    discomfort: boolean('discomfort').notNull().default(false),
    durationSeconds: integer('duration_seconds').notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    feeling: text('feeling').notNull(),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    signals: jsonb('signals')
      .$type<Array<{ id: string; label: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    stoolColor: text('stool_color'),
    stoolShape: text('stool_shape'),
    ...syncMetadata,
    createdAt,
  },
  (table) => [
    uniqueIndex('synced_toilet_sessions_user_record_unique').on(table.userId, table.recordId),
    index('synced_toilet_sessions_user_date_idx').on(table.userId, table.localDate),
    index('synced_toilet_sessions_expires_idx').on(table.expiresAt),
    check('synced_toilet_sessions_duration_check', sql`${table.durationSeconds} >= 0`),
  ],
);

export const syncedToiletSignalPresets = pgTable(
  'synced_toilet_signal_presets',
  {
    ...ownedRecord,
    label: text('label').notNull(),
    ...syncMetadata,
    createdAt,
  },
  (table) => [
    uniqueIndex('synced_toilet_signal_presets_user_record_unique').on(table.userId, table.recordId),
    uniqueIndex('synced_toilet_signal_presets_user_label_unique').on(table.userId, table.label),
  ],
);

export const dailyActivitySummaries = pgTable(
  'daily_activity_summaries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    summary: jsonb('summary').$type<DailyActivitySummary>().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex('daily_activity_summaries_user_date_unique').on(table.userId, table.localDate),
    index('daily_activity_summaries_expires_idx').on(table.expiresAt),
  ],
);

export const dataSyncChanges = pgTable(
  'data_sync_changes',
  {
    version: bigserial('version', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mutationId: text('mutation_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    operation: text('operation').notNull(),
    payload: jsonb('payload').$type<DataSyncPayload>(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt,
  },
  (table) => [
    uniqueIndex('data_sync_changes_user_mutation_unique').on(table.userId, table.mutationId),
    index('data_sync_changes_user_version_idx').on(table.userId, table.version),
    index('data_sync_changes_expires_idx').on(table.expiresAt),
    check('data_sync_changes_operation_check', sql`${table.operation} in ('upsert', 'delete')`),
  ],
);

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { QuietRange } from './common.js';
import { createdAt, updatedAt } from './common.js';
import { friendDataLevelEnum, friendEventKindEnum, friendNudgeAckStatusEnum, friendNudgeTypeEnum } from './enums.js';
import { users } from './users.js';

export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lowerUserId: uuid('lower_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    upperUserId: uuid('upper_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (table) => [
    uniqueIndex('friendships_pair_unique').on(table.lowerUserId, table.upperUserId),
    index('friendships_upper_user_idx').on(table.upperUserId),
    check('friendships_canonical_pair_check', sql`${table.lowerUserId} < ${table.upperUserId}`),
  ],
);

export const friendInvites = pgTable(
  'friend_invites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    inviterUserId: uuid('inviter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index('friend_invites_inviter_created_idx').on(table.inviterUserId, table.createdAt),
    uniqueIndex('friend_invites_token_hash_unique').on(table.tokenHash),
  ],
);

export const friendSettings = pgTable(
  'friend_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    friendshipId: uuid('friendship_id')
      .notNull()
      .references(() => friendships.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trainingLevel: friendDataLevelEnum('training_level').notNull().default('none'),
    habitLevel: friendDataLevelEnum('habit_level').notNull().default('none'),
    toiletLevel: friendDataLevelEnum('toilet_level').notNull().default('none'),
    historyDays: smallint('history_days').notNull().default(1),
    notifyFriendOnToiletEnd: boolean('notify_friend_on_toilet_end').notNull().default(false),
    notifyFriendOnToiletEndEnabledAt: timestamp('notify_friend_on_toilet_end_enabled_at', { withTimezone: true }),
    allowToiletEndNotificationsFromFriend: boolean('allow_toilet_end_notifications_from_friend')
      .notNull()
      .default(false),
    allowToiletEndNotificationsEnabledAt: timestamp('allow_toilet_end_notifications_enabled_at', {
      withTimezone: true,
    }),
    nudgesEnabled: boolean('nudges_enabled').notNull().default(true),
    nudgeDailyLimit: smallint('nudge_daily_limit').notNull().default(5),
    quietRanges: jsonb('quiet_ranges')
      .$type<QuietRange[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex('friend_settings_friendship_user_unique').on(table.friendshipId, table.userId),
    index('friend_settings_user_idx').on(table.userId),
    check('friend_settings_history_days_check', sql`${table.historyDays} in (1, 7, 30)`),
    check('friend_settings_nudge_daily_limit_check', sql`${table.nudgeDailyLimit} in (0, 3, 5, 8)`),
  ],
);

export const friendEvents = pgTable(
  'friend_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    friendshipId: uuid('friendship_id')
      .notNull()
      .references(() => friendships.id, { onDelete: 'cascade' }),
    fromUserId: uuid('from_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toUserId: uuid('to_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: friendEventKindEnum('kind').notNull(),
    nudgeType: friendNudgeTypeEnum('nudge_type'),
    message: text('message'),
    sourceEntityId: text('source_entity_id'),
    durationSeconds: integer('duration_seconds'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index('friend_events_friendship_occurred_idx').on(table.friendshipId, table.occurredAt, table.id),
    index('friend_events_to_occurred_idx').on(table.toUserId, table.occurredAt),
    index('friend_events_from_occurred_idx').on(table.fromUserId, table.occurredAt),
    uniqueIndex('friend_events_toilet_source_unique')
      .on(table.friendshipId, table.fromUserId, table.toUserId, table.sourceEntityId)
      .where(sql`${table.kind} = 'toilet_finished' and ${table.sourceEntityId} is not null`),
    check('friend_events_participants_differ_check', sql`${table.fromUserId} <> ${table.toUserId}`),
    check(
      'friend_events_kind_fields_check',
      sql`(${table.kind} = 'manual_nudge' and ${table.nudgeType} is not null and ${table.message} is not null and ${table.expiresAt} is not null) or (${table.kind} = 'toilet_finished' and ${table.sourceEntityId} is not null and ${table.durationSeconds} is not null)`,
    ),
    check('friend_events_duration_check', sql`${table.durationSeconds} is null or ${table.durationSeconds} >= 0`),
  ],
);

export const friendEventAcks = pgTable(
  'friend_event_acks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => friendEvents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: friendNudgeAckStatusEnum('status').notNull(),
    revisionCount: smallint('revision_count').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex('friend_event_acks_event_user_unique').on(table.eventId, table.userId),
    index('friend_event_acks_user_idx').on(table.userId),
    check('friend_event_acks_revision_count_check', sql`${table.revisionCount} between 0 and 1`),
  ],
);

export const friendNudgeDailyCounters = pgTable(
  'friend_nudge_daily_counters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    friendshipId: uuid('friendship_id')
      .notNull()
      .references(() => friendships.id, { onDelete: 'cascade' }),
    fromUserId: uuid('from_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toUserId: uuid('to_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    count: integer('count').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex('friend_nudge_daily_counter_unique').on(
      table.friendshipId,
      table.fromUserId,
      table.toUserId,
      table.localDate,
    ),
    index('friend_nudge_daily_counter_to_idx').on(table.toUserId),
    check('friend_nudge_daily_counter_count_check', sql`${table.count} >= 0`),
  ],
);

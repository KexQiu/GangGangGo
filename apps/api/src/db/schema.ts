import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const subscriptionEnvironmentEnum = pgEnum('subscription_environment', ['sandbox', 'production']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'grace_period',
  'expired',
  'revoked',
]);
export const autoRenewStatusEnum = pgEnum('auto_renew_status', ['on', 'off', 'unknown']);
export const teamMemberRoleEnum = pgEnum('team_member_role', ['owner', 'buddy']);
export const teamMemberStatusEnum = pgEnum('team_member_status', ['active', 'paused', 'removed']);
export const buddyNudgeTypeEnum = pgEnum('buddy_nudge_type', [
  'gentle',
  'move',
  'not_blank',
  'habit_left',
  'posture',
]);
export const buddyNudgeAckStatusEnum = pgEnum('buddy_nudge_ack_status', ['received', 'later', 'done']);
export const pushPlatformEnum = pgEnum('push_platform', ['ios', 'android']);
export const pushProviderEnum = pgEnum('push_provider', ['expo', 'apns']);

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export type QuietRange = {
  end: string;
  start: string;
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    appleUserId: text('apple_user_id').notNull(),
    nickname: text('nickname'),
    avatarUrl: text('avatar_url'),
    timezone: text('timezone').notNull().default('Asia/Shanghai'),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_apple_user_id_active_unique').on(table.appleUserId).where(sql`${table.deletedAt} is null`),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: text('product_id').notNull(),
    originalTransactionId: text('original_transaction_id').notNull(),
    latestTransactionId: text('latest_transaction_id'),
    environment: subscriptionEnvironmentEnum('environment').notNull().default('sandbox'),
    appAccountToken: uuid('app_account_token'),
    status: subscriptionStatusEnum('status').notNull().default('expired'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    autoRenewStatus: autoRenewStatusEnum('auto_renew_status').notNull().default('unknown'),
    lastNotificationType: text('last_notification_type'),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('subscriptions_user_status_idx').on(table.userId, table.status),
    uniqueIndex('subscriptions_original_transaction_id_unique').on(table.originalTransactionId),
  ],
);

export const subscriptionEvents = pgTable(
  'subscription_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    originalTransactionId: text('original_transaction_id'),
    transactionId: text('transaction_id'),
    environment: subscriptionEnvironmentEnum('environment').notNull().default('sandbox'),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingError: text('processing_error'),
  },
  (table) => [
    index('subscription_events_original_transaction_idx').on(table.originalTransactionId),
    index('subscription_events_received_at_idx').on(table.receivedAt),
  ],
);

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('我的小队'),
    createdAt,
    updatedAt,
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('teams_owner_active_unique').on(table.ownerUserId).where(sql`${table.archivedAt} is null`),
  ],
);

export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: teamMemberRoleEnum('role').notNull(),
    status: teamMemberStatusEnum('status').notNull().default('active'),
    displayName: text('display_name'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (table) => [
    index('team_members_team_status_idx').on(table.teamId, table.status),
    index('team_members_user_status_idx').on(table.userId, table.status),
    uniqueIndex('team_members_active_unique').on(table.teamId, table.userId).where(sql`${table.removedAt} is null`),
  ],
);

export const teamInvites = pgTable(
  'team_invites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
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
    index('team_invites_team_idx').on(table.teamId),
    uniqueIndex('team_invites_token_hash_unique').on(table.tokenHash),
  ],
);

export const shareSettings = pgTable(
  'share_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shareTraining: boolean('share_training').notNull().default(true),
    shareHabitCompletion: boolean('share_habit_completion').notNull().default(true),
    shareToiletRecorded: boolean('share_toilet_recorded').notNull().default(true),
    shareStreak: boolean('share_streak').notNull().default(true),
    paused: boolean('paused').notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex('share_settings_team_user_unique').on(table.teamId, table.userId)],
);

export const dailyShareSnapshots = pgTable(
  'daily_share_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    trainingDone: boolean('training_done').notNull().default(false),
    habitCompletion: smallint('habit_completion').notNull().default(0),
    toiletRecorded: boolean('toilet_recorded').notNull().default(false),
    streakDays: integer('streak_days').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('daily_share_snapshots_user_date_idx').on(table.userId, table.date),
    uniqueIndex('daily_share_snapshots_user_date_unique').on(table.userId, table.date),
    check('daily_share_snapshots_habit_completion_check', sql`${table.habitCompletion} between 0 and 4`),
    check('daily_share_snapshots_streak_days_check', sql`${table.streakDays} >= 0`),
  ],
);

export const dailyReportSnapshots = pgTable(
  'daily_report_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    trainingDone: boolean('training_done').notNull().default(false),
    habitCompletion: smallint('habit_completion').notNull().default(0),
    habitFull: boolean('habit_full').notNull().default(false),
    toiletRecorded: boolean('toilet_recorded').notNull().default(false),
    toiletLongMeeting: boolean('toilet_long_meeting').notNull().default(false),
    streakDays: integer('streak_days').notNull().default(0),
    weeklyTrainingDays: smallint('weekly_training_days').notNull().default(0),
    weeklyHabitFullDays: smallint('weekly_habit_full_days').notNull().default(0),
    weeklyToiletLongMeetingCount: smallint('weekly_toilet_long_meeting_count').notNull().default(0),
    thirtyDayTrainingDays: smallint('thirty_day_training_days').notNull().default(0),
    thirtyDayHabitFullDays: smallint('thirty_day_habit_full_days').notNull().default(0),
    thirtyDayToiletLongMeetingCount: smallint('thirty_day_toilet_long_meeting_count').notNull().default(0),
    ninetyDayTrainingDays: smallint('ninety_day_training_days').notNull().default(0),
    ninetyDayHabitFullDays: smallint('ninety_day_habit_full_days').notNull().default(0),
    ninetyDayToiletLongMeetingCount: smallint('ninety_day_toilet_long_meeting_count').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('daily_report_snapshots_user_date_idx').on(table.userId, table.date),
    uniqueIndex('daily_report_snapshots_user_date_unique').on(table.userId, table.date),
    check('daily_report_snapshots_habit_completion_check', sql`${table.habitCompletion} between 0 and 4`),
    check('daily_report_snapshots_streak_days_check', sql`${table.streakDays} >= 0`),
    check('daily_report_snapshots_weekly_training_days_check', sql`${table.weeklyTrainingDays} between 0 and 7`),
    check('daily_report_snapshots_weekly_habit_full_days_check', sql`${table.weeklyHabitFullDays} between 0 and 7`),
    check('daily_report_snapshots_weekly_long_meeting_check', sql`${table.weeklyToiletLongMeetingCount} >= 0`),
    check('daily_report_snapshots_thirty_day_training_days_check', sql`${table.thirtyDayTrainingDays} between 0 and 30`),
    check('daily_report_snapshots_thirty_day_habit_full_days_check', sql`${table.thirtyDayHabitFullDays} between 0 and 30`),
    check('daily_report_snapshots_thirty_day_long_meeting_check', sql`${table.thirtyDayToiletLongMeetingCount} >= 0`),
    check('daily_report_snapshots_ninety_day_training_days_check', sql`${table.ninetyDayTrainingDays} between 0 and 90`),
    check('daily_report_snapshots_ninety_day_habit_full_days_check', sql`${table.ninetyDayHabitFullDays} between 0 and 90`),
    check('daily_report_snapshots_ninety_day_long_meeting_check', sql`${table.ninetyDayToiletLongMeetingCount} >= 0`),
  ],
);

export const buddyNudges = pgTable(
  'buddy_nudges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    fromUserId: uuid('from_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toUserId: uuid('to_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: buddyNudgeTypeEnum('type').notNull(),
    messageTemplate: text('message_template').notNull(),
    createdAt,
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('buddy_nudges_to_created_idx').on(table.toUserId, table.createdAt),
    index('buddy_nudges_from_to_created_idx').on(table.fromUserId, table.toUserId, table.createdAt),
  ],
);

export const buddyNudgeAcks = pgTable(
  'buddy_nudge_acks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    nudgeId: uuid('nudge_id')
      .notNull()
      .references(() => buddyNudges.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: buddyNudgeAckStatusEnum('status').notNull(),
    revisionCount: smallint('revision_count').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex('buddy_nudge_acks_nudge_user_unique').on(table.nudgeId, table.userId),
    check('buddy_nudge_acks_revision_count_check', sql`${table.revisionCount} between 0 and 1`),
  ],
);

export const buddyNudgeSettings = pgTable(
  'buddy_nudge_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    buddyUserId: uuid('buddy_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dailyLimit: smallint('daily_limit').notNull().default(5),
    enabled: boolean('enabled').notNull().default(true),
    quietRanges: jsonb('quiet_ranges').$type<QuietRange[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex('buddy_nudge_settings_team_user_buddy_unique').on(table.teamId, table.userId, table.buddyUserId),
    check('buddy_nudge_settings_daily_limit_check', sql`${table.dailyLimit} in (0, 3, 5, 8)`),
  ],
);

export const pushTokens = pgTable(
  'push_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: pushPlatformEnum('platform').notNull(),
    provider: pushProviderEnum('provider').notNull().default('expo'),
    token: text('token').notNull(),
    deviceId: text('device_id'),
    enabled: boolean('enabled').notNull().default(true),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('push_tokens_user_enabled_idx').on(table.userId, table.enabled),
    uniqueIndex('push_tokens_provider_token_unique').on(table.provider, table.token),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    eventType: text('event_type').notNull(),
    targetType: text('target_type'),
    targetId: uuid('target_id'),
    createdAt,
  },
  (table) => [
    index('audit_events_user_created_idx').on(table.userId, table.createdAt),
    index('audit_events_target_idx').on(table.targetType, table.targetId),
  ],
);

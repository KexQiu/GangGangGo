import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { createdAt, type QuietRange, updatedAt } from './common.js';
import { buddyNudgeAckStatusEnum, buddyNudgeTypeEnum } from './enums.js';
import { teams } from './teams.js';
import { users } from './users.js';

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

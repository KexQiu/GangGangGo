import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { createdAt, updatedAt } from './common.js';
import { teams } from './teams.js';
import { users } from './users.js';

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

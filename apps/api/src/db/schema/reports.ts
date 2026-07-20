import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, pgTable, smallint, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, updatedAt } from './common.js';
import { users } from './users.js';

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
    toiletRecorded: boolean('toilet_recorded').notNull().default(false),
    toiletLongMeeting: boolean('toilet_long_meeting').notNull().default(false),
    streakDays: integer('streak_days').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('daily_report_snapshots_user_date_idx').on(table.userId, table.date),
    uniqueIndex('daily_report_snapshots_user_date_unique').on(table.userId, table.date),
    check('daily_report_snapshots_habit_completion_check', sql`${table.habitCompletion} between 0 and 4`),
    check('daily_report_snapshots_streak_days_check', sql`${table.streakDays} >= 0`),
  ],
);

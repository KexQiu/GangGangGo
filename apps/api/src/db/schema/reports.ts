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
    check(
      'daily_report_snapshots_thirty_day_training_days_check',
      sql`${table.thirtyDayTrainingDays} between 0 and 30`,
    ),
    check(
      'daily_report_snapshots_thirty_day_habit_full_days_check',
      sql`${table.thirtyDayHabitFullDays} between 0 and 30`,
    ),
    check('daily_report_snapshots_thirty_day_long_meeting_check', sql`${table.thirtyDayToiletLongMeetingCount} >= 0`),
    check(
      'daily_report_snapshots_ninety_day_training_days_check',
      sql`${table.ninetyDayTrainingDays} between 0 and 90`,
    ),
    check(
      'daily_report_snapshots_ninety_day_habit_full_days_check',
      sql`${table.ninetyDayHabitFullDays} between 0 and 90`,
    ),
    check('daily_report_snapshots_ninety_day_long_meeting_check', sql`${table.ninetyDayToiletLongMeetingCount} >= 0`),
  ],
);

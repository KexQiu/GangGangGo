import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, updatedAt } from './common.js';

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
    uniqueIndex('users_apple_user_id_active_unique')
      .on(table.appleUserId)
      .where(sql`${table.deletedAt} is null`),
  ],
);

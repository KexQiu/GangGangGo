import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { createdAt, updatedAt } from './common.js';
import { users } from './users.js';

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [index('auth_sessions_user_active_idx').on(table.userId, table.revokedAt, table.expiresAt)],
);

import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { createdAt, updatedAt } from './common.js';
import { pushPlatformEnum, pushProviderEnum } from './enums.js';
import { users } from './users.js';

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

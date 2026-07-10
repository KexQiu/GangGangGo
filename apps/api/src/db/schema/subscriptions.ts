import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { createdAt, updatedAt } from './common.js';
import {
  autoRenewStatusEnum,
  subscriptionEnvironmentEnum,
  subscriptionStatusEnum,
} from './enums.js';
import { users } from './users.js';

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

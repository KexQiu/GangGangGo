import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { users } from './users.js';

export const growthEvents = pgTable(
  'growth_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: text('event_id').notNull(),
    eventName: text('event_name').notNull(),
    installationId: text('installation_id').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    platform: text('platform').notNull(),
    appVersion: text('app_version').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    properties: jsonb('properties').$type<Record<string, string>>().notNull().default({}),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('growth_events_event_id_unique').on(table.eventId),
    index('growth_events_installation_occurred_idx').on(table.installationId, table.occurredAt),
    index('growth_events_user_occurred_idx').on(table.userId, table.occurredAt),
    index('growth_events_name_occurred_idx').on(table.eventName, table.occurredAt),
    index('growth_events_received_at_idx').on(table.receivedAt),
  ],
);

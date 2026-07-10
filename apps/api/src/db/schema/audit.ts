import {
  index,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

import { createdAt } from './common.js';
import { users } from './users.js';

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

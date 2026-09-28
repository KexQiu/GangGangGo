import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull(),
    resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('rate_limit_buckets_reset_idx').on(table.resetAt)],
);

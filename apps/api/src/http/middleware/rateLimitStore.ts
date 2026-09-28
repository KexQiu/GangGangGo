import { eq, lte, sql } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { rateLimitBuckets } from '../../db/schema.js';

type Budget = { maxRequests: number; windowMs: number };
type Entry = { count: number; resetAt: number };
export type RateLimitStore = { consume: (key: string, budget: Budget) => Promise<Entry | null> };

export function createMemoryRateLimitStore(maxEntries = 10_000, now = Date.now): RateLimitStore {
  const entries = new Map<string, Entry>();
  return {
    async consume(key, budget) {
      const timestamp = now();
      let entry = entries.get(key);
      if (!entry || entry.resetAt <= timestamp) {
        if (!entry && entries.size >= maxEntries) {
          for (const [candidate, value] of entries) if (value.resetAt <= timestamp) entries.delete(candidate);
          if (entries.size >= maxEntries) return null;
        }
        entry = { count: 0, resetAt: timestamp + budget.windowMs };
      }
      entry.count = Math.min(entry.count + 1, budget.maxRequests + 1);
      entries.set(key, entry);
      return { ...entry };
    },
  };
}

/** A single database budget shared by all API instances, with a hard cardinality cap. */
export function createDrizzleRateLimitStore(db: Database, maxEntries = 10_000): RateLimitStore {
  return {
    consume: (key, budget) =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('api-rate-limit', 0))`);
        const clock = await tx.execute<{ now: string }>(sql`select clock_timestamp() as now`);
        const now = new Date(clock[0]!.now);
        const [existing] = await tx.select().from(rateLimitBuckets).where(eq(rateLimitBuckets.key, key));
        if (!existing) {
          await tx.delete(rateLimitBuckets).where(lte(rateLimitBuckets.resetAt, now));
          const total = await tx.execute<{ count: number }>(
            sql`select count(*)::int as count from ${rateLimitBuckets}`,
          );
          if (total[0]!.count >= maxEntries) return null;
        }
        const entry = {
          count: existing && existing.resetAt > now ? Math.min(existing.count + 1, budget.maxRequests + 1) : 1,
          resetAt: existing && existing.resetAt > now ? existing.resetAt : new Date(now.getTime() + budget.windowMs),
        };
        await tx
          .insert(rateLimitBuckets)
          .values({ key, ...entry })
          .onConflictDoUpdate({ target: rateLimitBuckets.key, set: entry });
        return { count: entry.count, resetAt: entry.resetAt.getTime() };
      }),
  };
}

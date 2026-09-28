import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { rateLimitBuckets } from '../db/schema.js';
import { createDrizzleRateLimitStore } from '../http/middleware/rateLimitStore.js';
import { createIntegrationDatabaseClient, describeWithDatabase } from './postgresTestUtils.js';

describeWithDatabase('shared PostgreSQL rate limit', () => {
  it('shares an atomic budget across API instances and bounds new identities', async () => {
    const first = createIntegrationDatabaseClient();
    const second = createIntegrationDatabaseClient();
    const keys = Array.from({ length: 4 }, () => randomUUID());
    const budget = { maxRequests: 3, windowMs: 60_000 };
    try {
      const stores = [createDrizzleRateLimitStore(first.db, 2), createDrizzleRateLimitStore(second.db, 2)];
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, index) => stores[index % 2]!.consume(keys[0]!, budget)),
      );
      expect(results.filter((result) => result && result.count <= 3)).toHaveLength(3);
      expect(await stores[0]!.consume(keys[1]!, budget)).not.toBeNull();
      expect(await stores[1]!.consume(keys[2]!, budget)).toBeNull();
      await first.db
        .update(rateLimitBuckets)
        .set({ resetAt: new Date(0) })
        .where(inArray(rateLimitBuckets.key, keys));
      expect(await stores[1]!.consume(keys[3]!, budget)).toMatchObject({ count: 1 });
    } finally {
      await first.db.delete(rateLimitBuckets).where(inArray(rateLimitBuckets.key, keys));
      await Promise.all([first.close(), second.close()]);
    }
  });
});

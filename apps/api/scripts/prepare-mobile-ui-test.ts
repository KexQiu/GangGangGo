import { inArray } from 'drizzle-orm';

import { env } from '../src/config/env.js';
import { createDatabaseClient } from '../src/db/client.js';
import { subscriptions, users } from '../src/db/schema.js';

const mockUsers = [
  { appleUserId: 'mock:mock-user-a', nickname: '模拟搭子 A' },
  { appleUserId: 'mock:mock-user-b', nickname: '模拟搭子 B' },
  { appleUserId: 'mock:mock-user-c', nickname: '模拟搭子 C' },
] as const;

if (env.NODE_ENV === 'production') {
  throw new Error('Mobile UI test fixtures cannot be prepared in production.');
}

const client = createDatabaseClient(env);

try {
  await client.db.transaction(async (transaction) => {
    await transaction.delete(users).where(
      inArray(
        users.appleUserId,
        mockUsers.map((user) => user.appleUserId),
      ),
    );

    const createdUsers = await transaction.insert(users).values(mockUsers).returning();
    const owner = createdUsers.find((user) => user.appleUserId === 'mock:mock-user-a');

    if (!owner) {
      throw new Error('Failed to create mock-user-a.');
    }

    await transaction.insert(subscriptions).values({
      autoRenewStatus: 'on',
      environment: 'sandbox',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastVerifiedAt: new Date(),
      latestTransactionId: 'p1-mobile-ui-user-a',
      originalTransactionId: 'p1-mobile-ui-user-a',
      productId: 'xiaotidu.pro.monthly',
      status: 'active',
      userId: owner.id,
    });
  });

  process.stdout.write('Prepared isolated mobile UI fixtures for mock-user-a/b/c.\n');
} finally {
  await client.close();
}

import { randomUUID } from 'node:crypto';

import { inArray } from 'drizzle-orm';
import { describe } from 'vitest';

import type { DatabaseClient } from '../db/client.js';
import { createDatabaseClient } from '../db/client.js';
import { users } from '../db/schema.js';
import { createDrizzleUserRepository } from '../modules/users/userRepository.js';
import type { CurrentUser } from '../modules/users/userTypes.js';

export const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

export type QueryCounter = {
  count: () => number;
  logQuery: (query: string) => void;
  queries: () => string[];
  reset: () => void;
};

export function createQueryCounter(): QueryCounter {
  let statements: string[] = [];

  return {
    count: () => statements.length,
    logQuery(query) {
      statements.push(query);
    },
    queries: () => [...statements],
    reset() {
      statements = [];
    },
  };
}

export function createIntegrationDatabaseClient(queryCounter?: QueryCounter) {
  return createDatabaseClient(
    {
      DATABASE_URL: process.env.DATABASE_URL!,
      DB_POOL_MAX: 12,
      DB_SSL: false,
    },
    queryCounter ? { logger: queryCounter } : {},
  );
}

export async function createIntegrationUser(
  client: DatabaseClient,
  createdUserIds: string[],
  label: string,
): Promise<CurrentUser> {
  const repository = createDrizzleUserRepository(client.db);
  const user = await repository.upsertFromApple({
    appleUserId: `integration:${label}:${randomUUID()}`,
    nickname: label,
  });
  createdUserIds.push(user.id);
  return user;
}

export async function cleanupIntegrationUsers(client: DatabaseClient, createdUserIds: string[]) {
  if (createdUserIds.length > 0) {
    await client.db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await client.close();
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

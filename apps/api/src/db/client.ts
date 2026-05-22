import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import type { ApiEnv } from '../config/env.js';
import { env } from '../config/env.js';
import { ApiError } from '../http/apiError.js';
import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

export type DatabaseClient = {
  close: () => Promise<void>;
  db: Database;
  sql: Sql;
};

export function isDatabaseConfigured(config: Pick<ApiEnv, 'DATABASE_URL'> = env) {
  return Boolean(config.DATABASE_URL);
}

export function createDatabaseClient(config: Pick<ApiEnv, 'DATABASE_URL' | 'DB_SSL'> = env): DatabaseClient {
  if (!config.DATABASE_URL) {
    throw new ApiError(503, 'database_not_configured', '数据库连接还没有配置。');
  }

  const sqlClient = postgres(config.DATABASE_URL, {
    max: 5,
    ssl: config.DB_SSL ? 'require' : false,
  });

  return {
    close: async () => {
      await sqlClient.end({ timeout: 5 });
    },
    db: drizzle(sqlClient, { schema }),
    sql: sqlClient,
  };
}

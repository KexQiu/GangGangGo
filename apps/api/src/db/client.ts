import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Logger } from 'drizzle-orm/logger';
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

export function createDatabaseClient(
  config: Pick<ApiEnv, 'DATABASE_URL' | 'DB_SSL'> &
    Partial<Pick<ApiEnv, 'DB_CONNECT_TIMEOUT_SECONDS' | 'DB_IDLE_TIMEOUT_SECONDS' | 'DB_POOL_MAX'>> = env,
  options: { logger?: Logger } = {},
): DatabaseClient {
  if (!config.DATABASE_URL) {
    throw new ApiError(503, 'database_not_configured', '数据库连接还没有配置。');
  }

  const sqlClient = postgres(config.DATABASE_URL, {
    connect_timeout: config.DB_CONNECT_TIMEOUT_SECONDS ?? 10,
    idle_timeout: config.DB_IDLE_TIMEOUT_SECONDS ?? 20,
    max: config.DB_POOL_MAX ?? 5,
    ssl: config.DB_SSL ? 'require' : false,
  });

  return {
    close: async () => {
      await sqlClient.end({ timeout: 5 });
    },
    db: drizzle(sqlClient, { logger: options.logger, schema }),
    sql: sqlClient,
  };
}

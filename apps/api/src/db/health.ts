import type { DatabaseHealthResponse } from '@xiaotidu/contracts';

import type { ApiEnv } from '../config/env.js';
import { env } from '../config/env.js';
import { ApiError } from '../http/apiError.js';
import { createDatabaseClient } from './client.js';

export type DatabaseHealthChecker = () => Promise<DatabaseHealthResponse>;

export async function checkDatabaseHealth(config: Pick<ApiEnv, 'DATABASE_URL' | 'DB_SSL'> = env) {
  let client;

  try {
    client = createDatabaseClient(config);
    await client.sql`select 1`;

    return {
      database: 'reachable',
      ok: true,
    } satisfies DatabaseHealthResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(503, 'database_unreachable', '数据库暂时不可用。');
  } finally {
    await client?.close();
  }
}

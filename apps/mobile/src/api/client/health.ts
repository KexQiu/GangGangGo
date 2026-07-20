import type { ApiHealthResponse, DatabaseHealthResponse } from '@xiaotidu/contracts';
import { apiHealthResponseSchema, databaseHealthResponseSchema } from '@xiaotidu/contracts';

import { request } from './core';

export const healthApi = {
  checkDatabaseHealth: () => request<DatabaseHealthResponse>('/health/db', databaseHealthResponseSchema),
  checkHealth: () => request<ApiHealthResponse>('/health', apiHealthResponseSchema),
};

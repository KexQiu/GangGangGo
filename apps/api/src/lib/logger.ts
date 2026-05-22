import pino from 'pino';

import type { ApiEnv } from '../config/env.js';
import { env } from '../config/env.js';

export function createLogger(config: Pick<ApiEnv, 'LOG_LEVEL' | 'NODE_ENV'> = env) {
  return pino({
    enabled: config.LOG_LEVEL !== 'silent',
    level: config.LOG_LEVEL,
    name: 'xiaotidu-api',
  });
}

export const logger = createLogger();

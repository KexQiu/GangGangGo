import pino, { type DestinationStream, type LoggerOptions } from 'pino';

import type { ApiEnv } from '../config/env.js';
import { env } from '../config/env.js';

export function createLogger(config: Pick<ApiEnv, 'LOG_LEVEL' | 'NODE_ENV'> = env, destination?: DestinationStream) {
  const options: LoggerOptions = {
    enabled: config.LOG_LEVEL !== 'silent',
    level: config.LOG_LEVEL,
    name: 'xiaotidu-api',
    redact: {
      censor: '[Redacted]',
      paths: [
        'accessToken',
        'refreshToken',
        'token',
        '*.accessToken',
        '*.refreshToken',
        '*.token',
        'req.headers.authorization',
        'request.headers.authorization',
        'err.message',
        'err.stack',
        'error.message',
        'error.stack',
        'healthDetails',
        'symptoms',
        'note',
        'watchPayload',
        '*.healthDetails',
        '*.symptoms',
        '*.note',
        '*.watchPayload',
      ],
    },
  };

  return destination ? pino(options, destination) : pino(options);
}

export const logger = createLogger();

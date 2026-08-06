import pino, { type DestinationStream, type LoggerOptions } from 'pino';

import type { ApiEnv } from '../config/env.js';
import { env } from '../config/env.js';

function redactSensitiveText(value: string) {
  return value
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [Redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[Redacted JWT]')
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, '$1[Redacted]@')
    .replace(/([?&](?:access_token|refresh_token|token)=)[^&\s]+/gi, '$1[Redacted]');
}

function serializeError(error: unknown) {
  const serialized = pino.stdSerializers.err(error as Error);

  return {
    ...serialized,
    ...(typeof serialized.message === 'string' ? { message: redactSensitiveText(serialized.message) } : {}),
    ...(typeof serialized.stack === 'string' ? { stack: redactSensitiveText(serialized.stack) } : {}),
  };
}

export function createLogger(config: Pick<ApiEnv, 'LOG_LEVEL' | 'NODE_ENV'> = env, destination?: DestinationStream) {
  const options: LoggerOptions = {
    enabled: config.LOG_LEVEL !== 'silent',
    level: config.LOG_LEVEL,
    name: 'xiaotidu-api',
    serializers: {
      err: serializeError,
      error: serializeError,
    },
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

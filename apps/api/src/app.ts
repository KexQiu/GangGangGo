import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import type { Logger } from 'pino';
import { ZodError } from 'zod';

import { ApiError, isApiError } from './http/apiError.js';
import { toErrorResponse } from './http/responses.js';
import { logger as defaultLogger } from './lib/logger.js';
import { healthRoute } from './routes/health.js';
import { meRoute } from './routes/me.js';

type CreateApiAppOptions = {
  logger?: Logger;
};

export function createApiApp(options: CreateApiAppOptions = {}) {
  const log = options.logger ?? defaultLogger;
  const app = new Hono();

  app.use('*', requestId());
  app.use('*', async (context, next) => {
    const startedAt = Date.now();

    await next();

    log.info(
      {
        durationMs: Date.now() - startedAt,
        method: context.req.method,
        path: context.req.path,
        requestId: context.get('requestId'),
        status: context.res.status,
      },
      'request completed',
    );
  });

  app.route('/', healthRoute);
  app.route('/me', meRoute);

  app.notFound((context) => {
    const error = new ApiError(404, 'not_found', '没有找到这个接口。');
    return context.json(toErrorResponse(error.code, error.message), error.statusCode);
  });

  app.onError((error, context) => {
    if (isApiError(error)) {
      return context.json(toErrorResponse(error.code, error.message, error.details), error.statusCode);
    }

    if (error instanceof ZodError) {
      return context.json(toErrorResponse('validation_error', '请求参数不符合预期。', error.issues), 400);
    }

    log.error(
      {
        err: error,
        method: context.req.method,
        path: context.req.path,
        requestId: context.get('requestId'),
      },
      'request failed',
    );

    return context.json(toErrorResponse('internal_server_error', '服务暂时有点忙。'), 500);
  });

  return app;
}

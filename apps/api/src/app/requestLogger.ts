import type { MiddlewareHandler } from 'hono';
import type { Logger } from 'pino';

export function createRequestLogger(log: Logger): MiddlewareHandler {
  return async (context, next) => {
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
  };
}

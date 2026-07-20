import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Logger } from 'pino';
import { ZodError } from 'zod';

import { ApiError, isApiError } from '../http/apiError.js';
import { toErrorResponse } from '../http/responses.js';

function isJsonParseError(error: unknown) {
  return (
    (error instanceof SyntaxError && /JSON|Unexpected end/.test(error.message)) ||
    (error instanceof HTTPException && error.status === 400 && error.message === 'Malformed JSON in request body')
  );
}

export const notFoundHandler: NotFoundHandler = (context) => {
  const error = new ApiError(404, 'not_found', '没有找到这个接口。');

  return context.json(toErrorResponse(error.code, error.message), error.statusCode);
};

export function createErrorHandler(log: Logger): ErrorHandler {
  return (error, context) => {
    if (isApiError(error)) {
      return context.json(toErrorResponse(error.code, error.message, error.details), error.statusCode);
    }

    if (error instanceof ZodError) {
      return context.json(toErrorResponse('validation_error', '请求参数不符合预期。', error.issues), 400);
    }

    if (isJsonParseError(error)) {
      return context.json(toErrorResponse('validation_error', '请求体不是有效 JSON。'), 400);
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
  };
}

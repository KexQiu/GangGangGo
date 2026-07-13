import { OpenAPIHono, type RouteConfig } from '@hono/zod-openapi';
import type { Env } from 'hono';
import type { ZodType } from 'zod';
import { z } from 'zod';

import { apiErrorResponseSchema } from '@xiaotidu/contracts';

export const bearerSecurity = [{ bearerAuth: [] }] satisfies NonNullable<RouteConfig['security']>;

export function createOpenApiRouter<E extends Env = Env>() {
  return new OpenAPIHono<E>({
    defaultHook: (result) => {
      if (!result.success) {
        throw result.error;
      }
    },
  });
}

export function jsonRequest<T extends ZodType>(schema: T) {
  return {
    content: {
      'application/json': { schema },
    },
    required: true,
  } as const;
}

export function apiResponses(schema: ZodType): RouteConfig['responses'] {
  const errorResponse = {
    content: {
      'application/json': { schema: apiErrorResponseSchema },
    },
  } as const;

  return {
    200: {
      content: {
        'application/json': { schema: z.object({ data: schema }) },
      },
      description: '成功',
    },
    400: { ...errorResponse, description: '请求不合法' },
    401: { ...errorResponse, description: '未登录或会话失效' },
    403: { ...errorResponse, description: '没有操作权限' },
    404: { ...errorResponse, description: '资源不存在' },
    409: { ...errorResponse, description: '资源状态冲突' },
    429: { ...errorResponse, description: '请求超过限制' },
    500: { ...errorResponse, description: '服务内部错误' },
  };
}

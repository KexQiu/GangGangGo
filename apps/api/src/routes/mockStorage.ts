import { Hono } from 'hono';

import type { AvatarStorageService } from '../modules/storage/avatarStorageService.js';
import { ApiError } from '../http/apiError.js';

type CreateMockStorageRouteOptions = {
  avatarStorageService: AvatarStorageService;
};

export function createMockStorageRoute(options: CreateMockStorageRouteOptions) {
  const route = new Hono();

  route.put('/:objectKey', async (context) => {
    const objectKey = decodeURIComponent(context.req.param('objectKey'));
    const token = context.req.query('token') ?? null;
    const contentType = context.req.header('content-type') ?? null;
    const body = await context.req.arrayBuffer();

    await options.avatarStorageService.putMockObject({
      body,
      contentType,
      objectKey,
      token,
    });

    return new Response(null, {
      status: 204,
    });
  });

  route.get('/:objectKey', (context) => {
    const objectKey = decodeURIComponent(context.req.param('objectKey'));
    const object = options.avatarStorageService.getMockObject(objectKey);

    if (!object) {
      throw new ApiError(404, 'not_found', '头像文件不存在。');
    }

    const responseBody = object.body.buffer.slice(
      object.body.byteOffset,
      object.body.byteOffset + object.body.byteLength,
    ) as ArrayBuffer;

    return new Response(responseBody, {
      headers: {
        'cache-control': 'public, max-age=31536000, immutable',
        'content-type': object.contentType,
      },
    });
  });

  return route;
}

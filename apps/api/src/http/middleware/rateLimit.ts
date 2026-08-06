import { createHash } from 'node:crypto';

import type { MiddlewareHandler } from 'hono';

import { ApiError } from '../apiError.js';

type RateLimitOptions = {
  maxRequests: number;
  now?: () => number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

function hashIdentity(value: string) {
  return createHash('sha256').update(value).digest('base64url');
}

function getClientIdentity(request: Request) {
  const authorization = request.headers.get('authorization');

  if (authorization) {
    return `auth:${hashIdentity(authorization)}`;
  }

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ipAddress = forwardedFor || request.headers.get('x-real-ip') || 'anonymous';

  return `ip:${hashIdentity(ipAddress)}`;
}

export function createRateLimitMiddleware(options: RateLimitOptions): MiddlewareHandler {
  const entries = new Map<string, RateLimitEntry>();
  const now = options.now ?? Date.now;

  return async (context, next) => {
    const timestamp = now();
    const identity = getClientIdentity(context.req.raw);
    const existing = entries.get(identity);
    const entry =
      !existing || existing.resetAt <= timestamp ? { count: 0, resetAt: timestamp + options.windowMs } : existing;

    entry.count += 1;
    entries.set(identity, entry);

    const remaining = Math.max(options.maxRequests - entry.count, 0);
    context.header('RateLimit-Limit', String(options.maxRequests));
    context.header('RateLimit-Remaining', String(remaining));
    context.header('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > options.maxRequests) {
      context.header('Retry-After', String(Math.max(Math.ceil((entry.resetAt - timestamp) / 1000), 1)));
      throw new ApiError(429, 'rate_limited', '请求过于频繁，请稍后再试。');
    }

    if (entries.size > 10_000) {
      for (const [key, value] of entries) {
        if (value.resetAt <= timestamp) {
          entries.delete(key);
        }
      }
    }

    await next();
  };
}

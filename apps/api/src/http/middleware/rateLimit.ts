import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';

import { ApiError } from '../apiError.js';
import { createMemoryRateLimitStore, type RateLimitStore } from './rateLimitStore.js';

type RateLimitOptions = {
  maxRequests: number;
  now?: () => number;
  windowMs: number;
  store?: RateLimitStore;
  trustedProxyIps?: string[];
  identity?: (context: Context) => string;
};

export function clientAddress(context: Context, trustedProxyIps: string[] = []) {
  let peer = 'unknown';
  try {
    peer = normalizeAddress(getConnInfo(context).remote.address ?? 'unknown');
  } catch {
    /* Non-socket test adapter. */
  }
  if (trustedProxyIps.map(normalizeAddress).includes(peer)) {
    // The trusted proxy must overwrite this header with one client address.
    const forwarded = context.req.header('x-forwarded-for')?.trim();
    if (forwarded && isIP(forwarded)) return normalizeAddress(forwarded);
  }
  return peer;
}

function normalizeAddress(value: string) {
  return value.startsWith('::ffff:') && isIP(value.slice(7)) === 4 ? value.slice(7) : value;
}

export function createRateLimitMiddleware(options: RateLimitOptions): MiddlewareHandler {
  const now = options.now ?? Date.now;
  const store = options.store ?? createMemoryRateLimitStore(10_000, now);
  return async (context, next) => {
    const identity = options.identity?.(context) ?? `ip:${clientAddress(context, options.trustedProxyIps)}`;
    const key = createHash('sha256').update(identity).digest('hex');
    const entry = await store.consume(key, options);
    const resetAt = entry?.resetAt ?? now() + options.windowMs;
    context.header('RateLimit-Limit', String(options.maxRequests));
    context.header(
      'RateLimit-Remaining',
      String(Math.max(options.maxRequests - (entry?.count ?? options.maxRequests), 0)),
    );
    context.header('RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
    if (!entry || entry.count > options.maxRequests) {
      context.header('Retry-After', String(Math.max(Math.ceil((resetAt - now()) / 1000), 1)));
      throw new ApiError(429, 'rate_limited', '请求过于频繁，请稍后再试。');
    }
    await next();
  };
}

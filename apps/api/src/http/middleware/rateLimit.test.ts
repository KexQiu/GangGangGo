import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createErrorHandler } from '../../app/errorHandler.js';
import { logger } from '../../lib/logger.js';
import { createRateLimitMiddleware } from './rateLimit.js';

describe('rate limit middleware', () => {
  it('limits requests per client and exposes retry metadata', async () => {
    let timestamp = 1_000;
    const app = new Hono();
    app.use(
      '*',
      createRateLimitMiddleware({
        maxRequests: 2,
        now: () => timestamp,
        windowMs: 60_000,
      }),
    );
    app.get('/', (context) => context.text('ok'));
    app.onError(createErrorHandler(logger));

    expect((await app.request('/', { headers: { 'x-real-ip': '127.0.0.1' } })).status).toBe(200);
    expect((await app.request('/', { headers: { 'x-real-ip': '127.0.0.1' } })).status).toBe(200);

    const limited = await app.request('/', { headers: { 'x-real-ip': '127.0.0.1' } });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    expect(await limited.json()).toMatchObject({ error: { code: 'rate_limited' } });

    timestamp += 60_000;
    expect((await app.request('/', { headers: { 'x-real-ip': '127.0.0.1' } })).status).toBe(200);
  });
});

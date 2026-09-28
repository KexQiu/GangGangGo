import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createErrorHandler } from '../../app/errorHandler.js';
import { logger } from '../../lib/logger.js';
import { createRateLimitMiddleware } from './rateLimit.js';
import { createMemoryRateLimitStore } from './rateLimitStore.js';
import { createAuthMiddleware } from './auth.js';
import { createMockAuthSessionService } from '../../modules/auth/authSessionService.js';
import { createMockUserRepository } from '../../modules/users/userRepository.js';

describe('rate limit middleware', () => {
  it('keeps the authenticated user budget stable across token rotation and source changes', async () => {
    const users = createMockUserRepository();
    const auth = createMockAuthSessionService();
    const user = await users.upsertFromApple({ appleUserId: 'rate-user', nickname: 'rate-user' });
    const first = await auth.create(user.id);
    const app = new Hono();
    app.use(
      '*',
      createAuthMiddleware(
        users,
        auth,
        createRateLimitMiddleware({
          maxRequests: 1,
          windowMs: 60_000,
          identity: (context) => `user:${context.get('currentUser').id}`,
        }),
      ),
    );
    app.get('/', (context) => context.text('ok'));
    app.onError(createErrorHandler(logger));
    expect(
      (
        await app.request(
          '/',
          { headers: { authorization: `Bearer ${first.accessToken}` } },
          { incoming: { socket: { remoteAddress: '192.0.2.1' } } },
        )
      ).status,
    ).toBe(200);
    const rotated = await auth.rotate(first.refreshToken);
    expect(
      (
        await app.request(
          '/',
          { headers: { authorization: `Bearer ${rotated.session.accessToken}` } },
          { incoming: { socket: { remoteAddress: '192.0.2.2' } } },
        )
      ).status,
    ).toBe(429);
  });
  it('cannot gain a new budget by rotating invalid tokens or spoofed proxy headers', async () => {
    const app = new Hono();
    app.use('*', createRateLimitMiddleware({ maxRequests: 1, windowMs: 60_000 }));
    app.get('/', (c) => c.text('ok'));
    app.onError(createErrorHandler(logger));
    const env = { incoming: { socket: { remoteAddress: '192.0.2.1' } } };
    expect(
      (await app.request('/', { headers: { authorization: 'Bearer fake-1', 'x-real-ip': '1.1.1.1' } }, env)).status,
    ).toBe(200);
    expect(
      (await app.request('/', { headers: { authorization: 'Bearer fake-2', 'x-forwarded-for': '2.2.2.2' } }, env))
        .status,
    ).toBe(429);
  });

  it('uses one forwarded address only from an explicitly trusted peer', async () => {
    const app = new Hono();
    app.use('*', createRateLimitMiddleware({ maxRequests: 1, windowMs: 60_000, trustedProxyIps: ['127.0.0.1'] }));
    app.get('/', (c) => c.text('ok'));
    app.onError(createErrorHandler(logger));
    const env = { incoming: { socket: { remoteAddress: '::ffff:127.0.0.1' } } };
    const request = (value: string) => app.request('/', { headers: { 'x-forwarded-for': value } }, env);
    expect((await request('192.0.2.1')).status).toBe(200);
    expect((await request('192.0.2.1')).status).toBe(429);
    expect((await request('192.0.2.2')).status).toBe(200);
    expect((await request('192.0.2.3, 192.0.2.4')).status).toBe(200);
    expect((await request('invalid')).status).toBe(429); // Both fail back to the peer budget.
  });

  it('caps bucket count without evicting live budgets and reclaims expired entries', async () => {
    let time = 0;
    const store = createMemoryRateLimitStore(2, () => time);
    const budget = { maxRequests: 1, windowMs: 1000 };
    expect(await store.consume('a', budget)).toMatchObject({ count: 1 });
    expect(await store.consume('b', budget)).toMatchObject({ count: 1 });
    expect(await store.consume('c', budget)).toBeNull();
    expect(await store.consume('a', budget)).toMatchObject({ count: 2 });
    time = 1000;
    expect(await store.consume('c', budget)).toMatchObject({ count: 1 });
  });
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

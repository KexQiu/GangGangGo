import { describe, expect, it } from 'vitest';

import { createApiApp } from '../app.js';
import { createLogger } from '../lib/logger.js';

const testLogger = createLogger({
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
});

describe('api app', () => {
  const app = createApiApp({ logger: testLogger });

  it('returns health information', async () => {
    const response = await app.request('/health');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        ok: true,
        service: 'xiaotidu-api',
        version: '0.2.0',
      },
    });
  });

  it('returns mock entitlements', async () => {
    const response = await app.request('/me/entitlements');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        proStatus: 'free',
      },
    });
  });

  it('returns structured not found errors', async () => {
    const response = await app.request('/missing');
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: 'not_found',
        message: '没有找到这个接口。',
      },
    });
  });
});

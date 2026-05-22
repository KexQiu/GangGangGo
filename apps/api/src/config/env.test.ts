import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

describe('api env', () => {
  it('defaults Apple auth to mock outside production', () => {
    const env = loadEnv({
      JWT_SECRET: 'test-secret-with-length',
      NODE_ENV: 'development',
    });

    expect(env.APPLE_AUTH_MODE).toBe('mock');
  });

  it('defaults Apple auth to real in production', () => {
    const env = loadEnv({
      APPLE_BUNDLE_ID: 'com.kex.xiaotidu',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/xiaotidu',
      JWT_SECRET: 'test-secret-with-length',
      NODE_ENV: 'production',
    });

    expect(env.APPLE_AUTH_MODE).toBe('real');
  });

  it('rejects mock Apple auth in production', () => {
    expect(() =>
      loadEnv({
        APPLE_AUTH_MODE: 'mock',
        APPLE_BUNDLE_ID: 'com.kex.xiaotidu',
        DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/xiaotidu',
        JWT_SECRET: 'test-secret-with-length',
        NODE_ENV: 'production',
      }),
    ).toThrow();
  });
});

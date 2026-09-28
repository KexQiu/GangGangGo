import { describe, expect, it } from 'vitest';

import { authResponseSchema, userProfileSchema } from '../index.js';

describe('contracts exports', () => {
  it('validates auth sessions at runtime', () => {
    const user = userProfileSchema.parse({
      avatarUrl: null,
      id: '00000000-0000-4000-8000-000000000001',
      nickname: null,
      timezone: 'Asia/Shanghai',
    });
    expect(
      authResponseSchema.safeParse({
        session: {
          accessToken: 'access',
          accessTokenExpiresAt: '2026-07-11T12:00:00.000Z',
          refreshToken: 'refresh',
        },
        user,
      }).success,
    ).toBe(true);
  });
});

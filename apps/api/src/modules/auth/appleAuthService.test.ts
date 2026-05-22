import { describe, expect, it } from 'vitest';

import { createAppleJwtAuthService } from './appleAuthService.js';

describe('apple auth service', () => {
  it('fails fast when real Apple login is missing bundle id', () => {
    expect(() =>
      createAppleJwtAuthService({
        APPLE_BUNDLE_ID: undefined,
        APPLE_JWKS_URL: 'https://appleid.apple.com/auth/keys',
      }),
    ).toThrow('Apple 登录配置缺失。');
  });
});

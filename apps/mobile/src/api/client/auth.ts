import type { AppleLoginRequest, AuthResponse } from '@xiaotidu/contracts';
import { authResponseSchema } from '@xiaotidu/contracts';

import type { RuntimeSchema } from '../transport';
import { request } from './core';

const okResponseSchema: RuntimeSchema<{ ok: true }> = {
  parse(value) {
    if (!value || typeof value !== 'object' || (value as { ok?: unknown }).ok !== true) {
      throw new Error('Invalid success response.');
    }
    return { ok: true };
  },
};

export const authApi = {
  loginWithApple: (body: AppleLoginRequest) =>
    request<AuthResponse>('/auth/apple', authResponseSchema, { body, method: 'POST' }),
  logout: (token: string, refreshToken?: string | null) =>
    request<{ ok: true }>('/auth/logout', okResponseSchema, {
      body: refreshToken ? { refreshToken } : {},
      method: 'POST',
      token,
    }),
  refreshSession: (refreshToken: string) =>
    request<AuthResponse>('/auth/refresh', authResponseSchema, {
      allowAuthRefresh: false,
      body: { refreshToken },
      method: 'POST',
    }),
};

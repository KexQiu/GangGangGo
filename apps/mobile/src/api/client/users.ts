import type { AuthResponse, EntitlementsResponse, UpdateUserProfileRequest } from '@xiaotidu/contracts';
import { entitlementsResponseSchema, userProfileSchema } from '@xiaotidu/contracts';

import { request } from './core';

export const usersApi = {
  getCurrentUser: (token: string, signal?: AbortSignal) =>
    request<AuthResponse['user']>('/me', userProfileSchema, { signal, token }),
  getEntitlements: (token: string, signal?: AbortSignal) =>
    request<EntitlementsResponse>('/me/entitlements', entitlementsResponseSchema, { signal, token }),
  updateUserProfile: (body: UpdateUserProfileRequest, token: string) =>
    request<AuthResponse['user']>('/me', userProfileSchema, { body, method: 'PATCH', token }),
};

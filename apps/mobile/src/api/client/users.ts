import type {
  AccountDataExport,
  AccountDeletionResponse,
  AuthResponse,
  EntitlementsResponse,
  UpdateUserProfileRequest,
} from '@xiaotidu/contracts';
import {
  accountDataExportSchema,
  accountDeletionResponseSchema,
  entitlementsResponseSchema,
  userProfileSchema,
} from '@xiaotidu/contracts';

import { request } from './core';

export const usersApi = {
  deleteAccount: (token: string) =>
    request<AccountDeletionResponse>('/me', accountDeletionResponseSchema, { method: 'DELETE', token }),
  exportAccountData: (token: string) => request<AccountDataExport>('/me/export', accountDataExportSchema, { token }),
  getCurrentUser: (token: string, signal?: AbortSignal) =>
    request<AuthResponse['user']>('/me', userProfileSchema, { signal, token }),
  getEntitlements: (token: string, signal?: AbortSignal) =>
    request<EntitlementsResponse>('/me/entitlements', entitlementsResponseSchema, { signal, token }),
  updateUserProfile: (body: UpdateUserProfileRequest, token: string) =>
    request<AuthResponse['user']>('/me', userProfileSchema, { body, method: 'PATCH', token }),
};

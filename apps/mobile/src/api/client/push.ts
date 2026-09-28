import type { RegisterPushTokenRequest, RegisterPushTokenResponse } from '@xiaotidu/contracts';
import { registerPushTokenResponseSchema } from '@xiaotidu/contracts';

import { request } from './core';

export const pushApi = {
  revokeDevice: (deviceId: string, token: string) =>
    request(
      `/push-tokens/${encodeURIComponent(deviceId)}`,
      {
        parse: (value: unknown) => {
          if (!value || typeof value !== 'object' || (value as { ok?: unknown }).ok !== true)
            throw new Error('Invalid revoke response.');
          return { ok: true as const };
        },
      },
      { method: 'DELETE', token },
    ),
  registerPushToken: (body: RegisterPushTokenRequest, token: string) =>
    request<RegisterPushTokenResponse>('/push-tokens', registerPushTokenResponseSchema, {
      body,
      method: 'POST',
      token,
    }),
};

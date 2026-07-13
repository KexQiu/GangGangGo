import type { RegisterPushTokenRequest, RegisterPushTokenResponse } from '@xiaotidu/contracts';
import { registerPushTokenResponseSchema } from '@xiaotidu/contracts';

import { request } from './core';

export const pushApi = {
  registerPushToken: (body: RegisterPushTokenRequest, token: string) =>
    request<RegisterPushTokenResponse>('/push-tokens', registerPushTokenResponseSchema, {
      body,
      method: 'POST',
      token,
    }),
};

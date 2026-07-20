import type {
  RestoreSubscriptionRequest,
  SubscriptionActionResponse,
  VerifySubscriptionRequest,
} from '@xiaotidu/contracts';
import { subscriptionActionResponseSchema } from '@xiaotidu/contracts';

import { request } from './core';

export const subscriptionsApi = {
  restoreSubscription: (body: RestoreSubscriptionRequest, token: string) =>
    request<SubscriptionActionResponse>('/subscriptions/restore', subscriptionActionResponseSchema, {
      body,
      method: 'POST',
      token,
    }),
  verifySubscription: (body: VerifySubscriptionRequest, token: string) =>
    request<SubscriptionActionResponse>('/subscriptions/verify', subscriptionActionResponseSchema, {
      body,
      method: 'POST',
      token,
    }),
};

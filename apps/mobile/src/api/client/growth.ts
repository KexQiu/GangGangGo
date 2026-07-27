import type { GrowthEventsRequest, GrowthEventsResponse } from '@xiaotidu/contracts';
import { growthEventsResponseSchema } from '@xiaotidu/contracts';

import { request } from './core';

export const growthEventsApi = {
  submitAnonymous: (body: GrowthEventsRequest, signal?: AbortSignal) =>
    request<GrowthEventsResponse>('/growth-events', growthEventsResponseSchema, {
      body,
      method: 'POST',
      signal,
      token: null,
    }),
  submitAuthenticated: (body: GrowthEventsRequest, token: string, signal?: AbortSignal) =>
    request<GrowthEventsResponse>('/me/growth-events', growthEventsResponseSchema, {
      body,
      method: 'POST',
      signal,
      token,
    }),
};

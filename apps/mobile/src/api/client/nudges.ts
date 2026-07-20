import type {
  AckBuddyNudgeRequest,
  BuddyNudge,
  BuddyNudgeAckResponse,
  BuddyNudgeSettingsResponse,
  BuddyNudgeThreadResponse,
  CreateBuddyNudgeRequest,
  NudgeThreadsResponse,
  UpdateBuddyNudgeSettingsRequest,
} from '@xiaotidu/contracts';
import {
  buddyNudgeAckResponseSchema,
  buddyNudgeSchema,
  buddyNudgeSettingsResponseSchema,
  buddyNudgeThreadResponseSchema,
  nudgeThreadsResponseSchema,
} from '@xiaotidu/contracts';

import { request } from './core';

type NudgeThreadOptions = { before?: null | string; limit?: number };

export const nudgesApi = {
  ackNudge: (id: string, body: AckBuddyNudgeRequest, token: string) =>
    request<BuddyNudgeAckResponse>(`/nudges/${id}/ack`, buddyNudgeAckResponseSchema, { body, method: 'POST', token }),
  getBuddyNudgeSettings: (token: string) =>
    request<BuddyNudgeSettingsResponse>('/buddy-nudge-settings', buddyNudgeSettingsResponseSchema, { token }),
  getNudgeThread: (buddyUserId: string, options: NudgeThreadOptions, token: string, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (options.before) params.set('before', options.before);
    if (options.limit) params.set('limit', String(options.limit));
    const query = params.toString();
    return request<BuddyNudgeThreadResponse>(
      `/nudges/threads/${encodeURIComponent(buddyUserId)}${query ? `?${query}` : ''}`,
      buddyNudgeThreadResponseSchema,
      { signal, token },
    );
  },
  getNudgeThreads: (token: string, signal?: AbortSignal) =>
    request<NudgeThreadsResponse>('/nudges/threads', nudgeThreadsResponseSchema, { signal, token }),
  sendNudge: (body: CreateBuddyNudgeRequest, token: string) =>
    request<BuddyNudge>('/nudges', buddyNudgeSchema, { body, method: 'POST', token }),
  updateBuddyNudgeSettings: (buddyUserId: string, body: UpdateBuddyNudgeSettingsRequest, token: string) =>
    request<BuddyNudgeSettingsResponse>(`/buddy-nudge-settings/${buddyUserId}`, buddyNudgeSettingsResponseSchema, {
      body,
      method: 'PUT',
      token,
    }),
};

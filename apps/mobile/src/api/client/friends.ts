import type {
  AckFriendNudgeRequest,
  CreateFriendInviteResponse,
  CreateFriendNudgeRequest,
  FriendDataResponse,
  FriendEvent,
  FriendEventsResponse,
  FriendInvitePreviewResponse,
  FriendNudgeAckResponse,
  FriendResponse,
  FriendsResponse,
  UpdateFriendSettingsRequest,
} from '@xiaotidu/contracts';
import {
  createFriendInviteResponseSchema,
  friendDataResponseSchema,
  friendEventSchema,
  friendEventsResponseSchema,
  friendInvitePreviewResponseSchema,
  friendNudgeAckResponseSchema,
  friendResponseSchema,
  friendsResponseSchema,
} from '@xiaotidu/contracts';
import { z } from 'zod';

import { request } from './core';

type EventOptions = { before?: null | string; limit?: number };
const deleteFriendResponseSchema = z.object({ deleted: z.literal(true) }).strict();

export const friendsApi = {
  acceptInvite: (inviteToken: string, accessToken: string) =>
    request<FriendResponse>(`/friend-invites/${encodeURIComponent(inviteToken)}/accept`, friendResponseSchema, {
      method: 'POST',
      token: accessToken,
    }),
  ackNudge: (eventId: string, body: AckFriendNudgeRequest, token: string) =>
    request<FriendNudgeAckResponse>(`/friend-events/${encodeURIComponent(eventId)}/ack`, friendNudgeAckResponseSchema, {
      body,
      method: 'POST',
      token,
    }),
  createInvite: (token: string) =>
    request<CreateFriendInviteResponse>('/friend-invites', createFriendInviteResponseSchema, {
      method: 'POST',
      token,
    }),
  deleteFriend: (friendUserId: string, token: string) =>
    request<{ deleted: true }>(`/friends/${encodeURIComponent(friendUserId)}`, deleteFriendResponseSchema, {
      method: 'DELETE',
      token,
    }),
  getData: (friendUserId: string, token: string, signal?: AbortSignal) =>
    request<FriendDataResponse>(`/friends/${encodeURIComponent(friendUserId)}/data`, friendDataResponseSchema, {
      signal,
      token,
    }),
  getEvents: (friendUserId: string, options: EventOptions, token: string, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (options.before) params.set('before', options.before);
    if (options.limit) params.set('limit', String(options.limit));
    const query = params.toString();
    return request<FriendEventsResponse>(
      `/friends/${encodeURIComponent(friendUserId)}/events${query ? `?${query}` : ''}`,
      friendEventsResponseSchema,
      { signal, token },
    );
  },
  getFriend: (friendUserId: string, token: string, signal?: AbortSignal) =>
    request<FriendResponse>(`/friends/${encodeURIComponent(friendUserId)}`, friendResponseSchema, { signal, token }),
  getInvitePreview: (inviteToken: string, signal?: AbortSignal) =>
    request<FriendInvitePreviewResponse>(
      `/friend-invites/${encodeURIComponent(inviteToken)}`,
      friendInvitePreviewResponseSchema,
      { signal },
    ),
  list: (token: string, signal?: AbortSignal) =>
    request<FriendsResponse>('/friends', friendsResponseSchema, { signal, token }),
  sendNudge: (friendUserId: string, body: CreateFriendNudgeRequest, token: string) =>
    request<FriendEvent>(`/friends/${encodeURIComponent(friendUserId)}/nudges`, friendEventSchema, {
      body,
      method: 'POST',
      token,
    }),
  updateSettings: (friendUserId: string, body: UpdateFriendSettingsRequest, token: string) =>
    request<FriendResponse>(`/friends/${encodeURIComponent(friendUserId)}/settings`, friendResponseSchema, {
      body,
      method: 'PATCH',
      token,
    }),
};

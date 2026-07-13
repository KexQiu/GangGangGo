import type {
  AcceptTeamInviteRequest,
  AcceptTeamInviteResponse,
  AckBuddyNudgeRequest,
  AdvancedReportResponse,
  ApiHealthResponse,
  AppleLoginRequest,
  AuthResponse,
  BuddyNudge,
  BuddyNudgeAckResponse,
  BuddyNudgeSettingsResponse,
  BuddyNudgeThreadResponse,
  NudgeThreadsResponse,
  CreateBuddyNudgeRequest,
  CreateTeamInviteResponse,
  CreateTeamRequest,
  DailyReportSnapshotResponse,
  DailyReportSnapshotsBulkResponse,
  DailyShareSnapshotResponse,
  DatabaseHealthResponse,
  EntitlementsResponse,
  RegisterPushTokenRequest,
  RegisterPushTokenResponse,
  RestoreSubscriptionRequest,
  ShareSettingsResponse,
  SubscriptionActionResponse,
  TeamInvitePreviewResponse,
  TeamResponse,
  TeamSnapshotsResponse,
  TeamWeeklyReportResponse,
  UpdateBuddyNudgeSettingsRequest,
  UpdateShareSettingsRequest,
  UpdateTeamMemberStatusRequest,
  UpdateTeamRequest,
  UpdateUserProfileRequest,
  UpsertDailyReportSnapshotRequest,
  UpsertDailyReportSnapshotsBulkRequest,
  UpsertDailyShareSnapshotRequest,
  VerifySubscriptionRequest,
} from '@xiaotidu/contracts';
import {
  advancedReportResponseSchema,
  apiHealthResponseSchema,
  authResponseSchema,
  buddyNudgeAckResponseSchema,
  buddyNudgeSchema,
  buddyNudgeSettingsResponseSchema,
  buddyNudgeThreadResponseSchema,
  nudgeThreadsResponseSchema,
  createTeamInviteResponseSchema,
  dailyReportSnapshotResponseSchema,
  dailyReportSnapshotsBulkResponseSchema,
  dailyShareSnapshotResponseSchema,
  databaseHealthResponseSchema,
  entitlementsResponseSchema,
  registerPushTokenResponseSchema,
  shareSettingsResponseSchema,
  subscriptionActionResponseSchema,
  teamInvitePreviewResponseSchema,
  teamResponseSchema,
  teamSnapshotsResponseSchema,
  teamWeeklyReportResponseSchema,
  userProfileSchema,
} from '@xiaotidu/contracts';

import { getApiBaseUrl } from '../config/api';
import { ApiTransport, type RuntimeSchema } from './transport';

type NudgeThreadOptions = { before?: null | string; limit?: number };

const okResponseSchema: RuntimeSchema<{ ok: true }> = {
  parse(value) {
    if (!value || typeof value !== 'object' || (value as { ok?: unknown }).ok !== true) {
      throw new Error('Invalid success response.');
    }
    return { ok: true };
  },
};

const transport = new ApiTransport({ baseUrl: getApiBaseUrl });

export function setApiUnauthorizedHandler(handler: (() => void) | null) {
  transport.setUnauthorizedHandler(handler);
}

export function setApiSessionRefreshHandler(handler: (() => Promise<string | null>) | null) {
  transport.setSessionRefreshHandler(handler);
}

const request = transport.request.bind(transport);

export { ApiClientError } from './transport';

export const apiClient = {
  acceptTeamInvite: (token: string, body: AcceptTeamInviteRequest, accessToken: string) =>
    request<AcceptTeamInviteResponse>(`/team-invites/${encodeURIComponent(token)}/accept`, teamResponseSchema, {
      body,
      method: 'POST',
      token: accessToken,
    }),
  ackNudge: (id: string, body: AckBuddyNudgeRequest, token: string) =>
    request<BuddyNudgeAckResponse>(`/nudges/${id}/ack`, buddyNudgeAckResponseSchema, { body, method: 'POST', token }),
  checkDatabaseHealth: () => request<DatabaseHealthResponse>('/health/db', databaseHealthResponseSchema),
  checkHealth: () => request<ApiHealthResponse>('/health', apiHealthResponseSchema),
  createTeam: (body: CreateTeamRequest, token: string) =>
    request<TeamResponse>('/teams', teamResponseSchema, { body, method: 'POST', token }),
  createTeamInvite: (token: string) =>
    request<CreateTeamInviteResponse>('/teams/current/invites', createTeamInviteResponseSchema, {
      method: 'POST',
      token,
    }),
  getAdvancedReport: (token: string, signal?: AbortSignal) =>
    request<AdvancedReportResponse>('/reports/advanced?range=90d', advancedReportResponseSchema, { signal, token }),
  getBuddyNudgeSettings: (token: string) =>
    request<BuddyNudgeSettingsResponse>('/buddy-nudge-settings', buddyNudgeSettingsResponseSchema, { token }),
  getCurrentTeam: (token: string, signal?: AbortSignal) =>
    request<TeamResponse>('/teams/current', teamResponseSchema, { signal, token }),
  getCurrentUser: (token: string) => request<AuthResponse['user']>('/me', userProfileSchema, { token }),
  getEntitlements: (token: string) =>
    request<EntitlementsResponse>('/me/entitlements', entitlementsResponseSchema, { token }),
  getNudgeThreads: (token: string, signal?: AbortSignal) =>
    request<NudgeThreadsResponse>('/nudges/threads', nudgeThreadsResponseSchema, { signal, token }),
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
  getTeamInvitePreview: (token: string, signal?: AbortSignal) =>
    request<TeamInvitePreviewResponse>(`/team-invites/${encodeURIComponent(token)}`, teamInvitePreviewResponseSchema, {
      signal,
    }),
  getTeamSnapshots: (token: string, signal?: AbortSignal) =>
    request<TeamSnapshotsResponse>('/teams/current/snapshots', teamSnapshotsResponseSchema, { signal, token }),
  getTeamWeeklyReport: (token: string, signal?: AbortSignal) =>
    request<TeamWeeklyReportResponse>('/teams/current/reports/weekly', teamWeeklyReportResponseSchema, {
      signal,
      token,
    }),
  leaveTeam: (token: string) =>
    request<TeamResponse>('/teams/current/leave', teamResponseSchema, { method: 'POST', token }),
  loginWithApple: (body: AppleLoginRequest) =>
    request<AuthResponse>('/auth/apple', authResponseSchema, { body, method: 'POST' }),
  refreshSession: (refreshToken: string) =>
    request<AuthResponse>('/auth/refresh', authResponseSchema, {
      allowAuthRefresh: false,
      body: { refreshToken },
      method: 'POST',
    }),
  logout: (token: string, refreshToken?: string | null) =>
    request<{ ok: true }>('/auth/logout', okResponseSchema, {
      body: refreshToken ? { refreshToken } : {},
      method: 'POST',
      token,
    }),
  registerPushToken: (body: RegisterPushTokenRequest, token: string) =>
    request<RegisterPushTokenResponse>('/push-tokens', registerPushTokenResponseSchema, {
      body,
      method: 'POST',
      token,
    }),
  removeMember: (memberId: string, token: string) =>
    request<TeamResponse>(`/teams/current/members/${memberId}`, teamResponseSchema, { method: 'DELETE', token }),
  restoreSubscription: (body: RestoreSubscriptionRequest, token: string) =>
    request<SubscriptionActionResponse>('/subscriptions/restore', subscriptionActionResponseSchema, {
      body,
      method: 'POST',
      token,
    }),
  sendNudge: (body: CreateBuddyNudgeRequest, token: string) =>
    request<BuddyNudge>('/nudges', buddyNudgeSchema, { body, method: 'POST', token }),
  updateBuddyNudgeSettings: (buddyUserId: string, body: UpdateBuddyNudgeSettingsRequest, token: string) =>
    request<BuddyNudgeSettingsResponse>(`/buddy-nudge-settings/${buddyUserId}`, buddyNudgeSettingsResponseSchema, {
      body,
      method: 'PUT',
      token,
    }),
  updateMyMemberStatus: (body: UpdateTeamMemberStatusRequest, token: string) =>
    request<TeamResponse>('/teams/current/members/me/status', teamResponseSchema, { body, method: 'PATCH', token }),
  updateShareSettings: (body: UpdateShareSettingsRequest, token: string) =>
    request<ShareSettingsResponse>('/share-settings', shareSettingsResponseSchema, { body, method: 'PUT', token }),
  updateTeam: (body: UpdateTeamRequest, token: string) =>
    request<TeamResponse>('/teams/current', teamResponseSchema, { body, method: 'PATCH', token }),
  updateUserProfile: (body: UpdateUserProfileRequest, token: string) =>
    request<AuthResponse['user']>('/me', userProfileSchema, { body, method: 'PATCH', token }),
  upsertReportSnapshot: (body: UpsertDailyReportSnapshotRequest, token: string) =>
    request<DailyReportSnapshotResponse>('/report-snapshots/today', dailyReportSnapshotResponseSchema, {
      body,
      method: 'PUT',
      token,
    }),
  upsertReportSnapshotsBulk: (body: UpsertDailyReportSnapshotsBulkRequest, token: string) =>
    request<DailyReportSnapshotsBulkResponse>('/report-snapshots/bulk', dailyReportSnapshotsBulkResponseSchema, {
      body,
      method: 'PUT',
      token,
    }),
  upsertShareSnapshot: (body: UpsertDailyShareSnapshotRequest, token: string) =>
    request<DailyShareSnapshotResponse>('/share-snapshots/today', dailyShareSnapshotResponseSchema, {
      body,
      method: 'PUT',
      token,
    }),
  verifySubscription: (body: VerifySubscriptionRequest, token: string) =>
    request<SubscriptionActionResponse>('/subscriptions/verify', subscriptionActionResponseSchema, {
      body,
      method: 'POST',
      token,
    }),
};

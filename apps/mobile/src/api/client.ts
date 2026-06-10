import type {
  AcceptTeamInviteRequest,
  AcceptTeamInviteResponse,
  AckBuddyNudgeRequest,
  AdvancedReportResponse,
  ApiErrorResponse,
  ApiHealthResponse,
  AppleLoginRequest,
  AuthResponse,
  BuddyNudge,
  BuddyNudgeAckResponse,
  BuddyNudgeSettingsResponse,
  BuddyNudgesResponse,
  CreateBuddyNudgeRequest,
  CreateAvatarUploadRequest,
  CreateAvatarUploadResponse,
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
  UpdateUserProfileRequest,
  UpdateShareSettingsRequest,
  UpdateTeamMemberStatusRequest,
  UpdateTeamRequest,
  UpsertDailyReportSnapshotRequest,
  UpsertDailyReportSnapshotsBulkRequest,
  UpsertDailyShareSnapshotRequest,
  VerifySubscriptionRequest,
} from '@xiaotidu/contracts';

import { getApiBaseUrl } from '../config/api';

export class ApiClientError extends Error {
  code: string;
  details?: unknown;
  status: number;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

type RequestOptions = {
  body?: unknown;
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  token?: null | string;
};

type ApiSuccessResponse<T> = {
  data: T;
};

let unauthorizedHandler: (() => void) | null = null;

export function setApiUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: {
      accept: 'application/json',
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    method: options.method ?? 'GET',
  });
  const text = await response.text();
  const parsed: unknown = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = parsed as ApiErrorResponse;
    if (response.status === 401) {
      unauthorizedHandler?.();
    }

    throw new ApiClientError(
      response.status,
      error.error?.code ?? 'internal_error',
      error.error?.message ?? '请求失败了，稍后再试。',
      error.error?.details,
    );
  }

  return (parsed as ApiSuccessResponse<T>).data;
}

export const apiClient = {
  acceptTeamInvite: (token: string, body: AcceptTeamInviteRequest, accessToken: string) =>
    request<AcceptTeamInviteResponse>(`/team-invites/${encodeURIComponent(token)}/accept`, {
      body,
      method: 'POST',
      token: accessToken,
    }),
  ackNudge: (id: string, body: AckBuddyNudgeRequest, token: string) =>
    request<BuddyNudgeAckResponse>(`/nudges/${id}/ack`, { body, method: 'POST', token }),
  checkDatabaseHealth: () => request<DatabaseHealthResponse>('/health/db'),
  checkHealth: () => request<ApiHealthResponse>('/health'),
  createTeam: (body: CreateTeamRequest, token: string) =>
    request<TeamResponse>('/teams', { body, method: 'POST', token }),
  createAvatarUpload: (body: CreateAvatarUploadRequest, token: string) =>
    request<CreateAvatarUploadResponse>('/me/avatar-upload', { body, method: 'POST', token }),
  createTeamInvite: (token: string) =>
    request<CreateTeamInviteResponse>('/teams/current/invites', { method: 'POST', token }),
  getAdvancedReport: (token: string) => request<AdvancedReportResponse>('/reports/advanced?range=90d', { token }),
  getBuddyNudgeSettings: (token: string) => request<BuddyNudgeSettingsResponse>('/buddy-nudge-settings', { token }),
  getCurrentTeam: (token: string) => request<TeamResponse>('/teams/current', { token }),
  getCurrentUser: (token: string) => request<AuthResponse['user']>('/me', { token }),
  getEntitlements: (token: string) => request<EntitlementsResponse>('/me/entitlements', { token }),
  getNudgeInbox: (token: string) => request<BuddyNudgesResponse>('/nudges/inbox', { token }),
  getNudgeSent: (token: string) => request<BuddyNudgesResponse>('/nudges/sent', { token }),
  getTeamInvitePreview: (token: string) =>
    request<TeamInvitePreviewResponse>(`/team-invites/${encodeURIComponent(token)}`),
  getTeamSnapshots: (token: string) => request<TeamSnapshotsResponse>('/teams/current/snapshots', { token }),
  getTeamWeeklyReport: (token: string) =>
    request<TeamWeeklyReportResponse>('/teams/current/reports/weekly', { token }),
  leaveTeam: (token: string) => request<TeamResponse>('/teams/current/leave', { method: 'POST', token }),
  loginWithApple: (body: AppleLoginRequest) =>
    request<AuthResponse>('/auth/apple', { body, method: 'POST' }),
  logout: (token: string) => request<{ ok: true }>('/auth/logout', { method: 'POST', token }),
  registerPushToken: (body: RegisterPushTokenRequest, token: string) =>
    request<RegisterPushTokenResponse>('/push-tokens', { body, method: 'POST', token }),
  removeMember: (memberId: string, token: string) =>
    request<TeamResponse>(`/teams/current/members/${memberId}`, { method: 'DELETE', token }),
  restoreSubscription: (body: RestoreSubscriptionRequest, token: string) =>
    request<SubscriptionActionResponse>('/subscriptions/restore', { body, method: 'POST', token }),
  sendNudge: (body: CreateBuddyNudgeRequest, token: string) =>
    request<BuddyNudge>('/nudges', { body, method: 'POST', token }),
  updateBuddyNudgeSettings: (buddyUserId: string, body: UpdateBuddyNudgeSettingsRequest, token: string) =>
    request<BuddyNudgeSettingsResponse>(`/buddy-nudge-settings/${buddyUserId}`, { body, method: 'PUT', token }),
  updateMyMemberStatus: (body: UpdateTeamMemberStatusRequest, token: string) =>
    request<TeamResponse>('/teams/current/members/me/status', { body, method: 'PATCH', token }),
  updateShareSettings: (body: UpdateShareSettingsRequest, token: string) =>
    request<ShareSettingsResponse>('/share-settings', { body, method: 'PUT', token }),
  updateTeam: (body: UpdateTeamRequest, token: string) =>
    request<TeamResponse>('/teams/current', { body, method: 'PATCH', token }),
  updateUserProfile: (body: UpdateUserProfileRequest, token: string) =>
    request<AuthResponse['user']>('/me', { body, method: 'PATCH', token }),
  upsertReportSnapshot: (body: UpsertDailyReportSnapshotRequest, token: string) =>
    request<DailyReportSnapshotResponse>('/report-snapshots/today', { body, method: 'PUT', token }),
  upsertReportSnapshotsBulk: (body: UpsertDailyReportSnapshotsBulkRequest, token: string) =>
    request<DailyReportSnapshotsBulkResponse>('/report-snapshots/bulk', { body, method: 'PUT', token }),
  upsertShareSnapshot: (body: UpsertDailyShareSnapshotRequest, token: string) =>
    request<DailyShareSnapshotResponse>('/share-snapshots/today', { body, method: 'PUT', token }),
  verifySubscription: (body: VerifySubscriptionRequest, token: string) =>
    request<SubscriptionActionResponse>('/subscriptions/verify', { body, method: 'POST', token }),
};

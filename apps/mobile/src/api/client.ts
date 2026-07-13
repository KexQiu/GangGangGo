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
  BuddyNudgeThreadResponse,
  BuddyNudgesResponse,
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
  apiErrorResponseSchema,
  apiHealthResponseSchema,
  authResponseSchema,
  buddyNudgeAckResponseSchema,
  buddyNudgeSchema,
  buddyNudgeSettingsResponseSchema,
  buddyNudgeThreadResponseSchema,
  buddyNudgesResponseSchema,
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

type RuntimeSchema<T> = { parse: (value: unknown) => T };
type RequestOptions = {
  allowAuthRefresh?: boolean;
  body?: unknown;
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  signal?: AbortSignal;
  token?: null | string;
};
type NudgeThreadOptions = { before?: null | string; limit?: number };
type ApiSuccessResponse<T> = { data: T };

const requestTimeoutMs = 10_000;
const okResponseSchema: RuntimeSchema<{ ok: true }> = {
  parse(value) {
    if (!value || typeof value !== 'object' || (value as { ok?: unknown }).ok !== true) {
      throw new Error('Invalid success response.');
    }
    return { ok: true };
  },
};

let unauthorizedHandler: (() => void) | null = null;
let sessionRefreshHandler: (() => Promise<string | null>) | null = null;

export function setApiUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function setApiSessionRefreshHandler(handler: (() => Promise<string | null>) | null) {
  sessionRefreshHandler = handler;
}

async function request<T>(path: string, schema: RuntimeSchema<T>, options: RequestOptions = {}): Promise<T> {
  return requestAttempt(path, schema, options, 0, false);
}

async function requestAttempt<T>(
  path: string,
  schema: RuntimeSchema<T>,
  options: RequestOptions,
  retryCount: number,
  didRefresh: boolean,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const abortFromParent = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromParent, { once: true });
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: {
        accept: 'application/json',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      method: options.method ?? 'GET',
      signal: controller.signal,
    });
  } catch {
    const method = options.method ?? 'GET';
    const parentAborted = options.signal?.aborted === true;
    const timedOut = controller.signal.aborted && !parentAborted;
    if (!parentAborted && retryCount === 0 && (method === 'GET' || method === 'PUT')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return requestAttempt(path, schema, options, retryCount + 1, didRefresh);
    }
    throw new ApiClientError(
      0,
      parentAborted ? 'cancelled' : timedOut ? 'timeout' : 'network_error',
      parentAborted ? '请求已取消。' : timedOut ? '请求超时，请稍后再试。' : '网络连接失败。',
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromParent);
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiClientError(response.status, 'invalid_response', '服务返回了无法识别的数据。');
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      options.token &&
      options.allowAuthRefresh !== false &&
      !didRefresh &&
      sessionRefreshHandler
    ) {
      const nextToken = await sessionRefreshHandler();
      if (nextToken) return requestAttempt(path, schema, { ...options, token: nextToken }, retryCount, true);
    }

    const parsedError = apiErrorResponseSchema.safeParse(parsed);
    const error: ApiErrorResponse | null = parsedError.success ? parsedError.data : null;
    if (response.status === 401 && options.token) unauthorizedHandler?.();
    throw new ApiClientError(
      response.status,
      error?.error.code ?? 'internal_error',
      error?.error.message ?? '请求失败了，稍后再试。',
      error?.error.details,
    );
  }

  try {
    return schema.parse((parsed as ApiSuccessResponse<unknown>).data);
  } catch {
    throw new ApiClientError(response.status, 'invalid_response', '服务返回的数据不符合约定。');
  }
}

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
  getAdvancedReport: (token: string) =>
    request<AdvancedReportResponse>('/reports/advanced?range=90d', advancedReportResponseSchema, { token }),
  getBuddyNudgeSettings: (token: string) =>
    request<BuddyNudgeSettingsResponse>('/buddy-nudge-settings', buddyNudgeSettingsResponseSchema, { token }),
  getCurrentTeam: (token: string) => request<TeamResponse>('/teams/current', teamResponseSchema, { token }),
  getCurrentUser: (token: string) => request<AuthResponse['user']>('/me', userProfileSchema, { token }),
  getEntitlements: (token: string) =>
    request<EntitlementsResponse>('/me/entitlements', entitlementsResponseSchema, { token }),
  getNudgeInbox: (token: string) => request<BuddyNudgesResponse>('/nudges/inbox', buddyNudgesResponseSchema, { token }),
  getNudgeSent: (token: string) => request<BuddyNudgesResponse>('/nudges/sent', buddyNudgesResponseSchema, { token }),
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
  getTeamInvitePreview: (token: string) =>
    request<TeamInvitePreviewResponse>(`/team-invites/${encodeURIComponent(token)}`, teamInvitePreviewResponseSchema),
  getTeamSnapshots: (token: string) =>
    request<TeamSnapshotsResponse>('/teams/current/snapshots', teamSnapshotsResponseSchema, { token }),
  getTeamWeeklyReport: (token: string) =>
    request<TeamWeeklyReportResponse>('/teams/current/reports/weekly', teamWeeklyReportResponseSchema, { token }),
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

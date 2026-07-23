import { describe, expect, it, vi } from 'vitest';

import type { AdvancedReportSummary, AuthSession, DailyReportSnapshot } from '@xiaotidu/contracts';

import { createApiApp } from '../app.js';
import { checkDatabaseHealth } from '../db/health.js';
import { ApiError } from '../http/apiError.js';
import { createLogger } from '../lib/logger.js';
import { SessionUserUnavailableError, type AuthSessionService } from '../modules/auth/authSessionService.js';
import type { EntitlementsService } from '../modules/entitlements/entitlementsService.js';
import type { ReportService } from '../modules/reports/reportService.js';
import type { UserRepository } from '../modules/users/userRepository.js';

const testLogger = createLogger({
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
});

function createTestApp() {
  return createApiApp({ logger: testLogger });
}

const proEntitlementsService: EntitlementsService = {
  async getEntitlements() {
    return { proStatus: 'pro_active' };
  },
};

async function login(app: ReturnType<typeof createApiApp>, input: { identityToken?: string; nickname?: string } = {}) {
  const loginResponse = await app.request('/auth/apple', {
    body: JSON.stringify({
      identityToken: input.identityToken ?? 'apple-test-token',
      ...(input.nickname ? { nickname: input.nickname } : {}),
    }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });
  const loginBody = await loginResponse.json();

  return loginBody.data.session.accessToken as string;
}

function getTestDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function createDailyReportSnapshot(input: Partial<DailyReportSnapshot> = {}): DailyReportSnapshot {
  return {
    date: getTestDateKey(),
    habitCompletion: 4,
    streakDays: 9,
    toiletLongMeeting: false,
    toiletRecorded: true,
    trainingDone: true,
    ...input,
  };
}

function repeatAdvancedSummary(summary: AdvancedReportSummary) {
  return { '7d': summary, '30d': summary, '90d': summary };
}

describe('api app', () => {
  it('returns health information', async () => {
    const app = createTestApp();
    const response = await app.request('/health');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        ok: true,
        service: 'xiaotidu-api',
        version: '0.2.0',
      },
    });
  });

  it('logs in with a mock Apple identity token', async () => {
    const app = createTestApp();
    const response = await app.request('/auth/apple', {
      body: JSON.stringify({
        identityToken: 'apple-test-token',
        nickname: '测试用户',
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.session.accessToken).toEqual(expect.any(String));
    expect(body).toEqual({
      data: {
        session: {
          accessToken: body.data.session.accessToken,
          accessTokenExpiresAt: expect.any(String),
          refreshToken: expect.any(String),
        },
        user: {
          avatarUrl: null,
          id: '00000000-0000-4000-8000-000000000001',
          nickname: '测试用户',
          timezone: 'Asia/Shanghai',
        },
      },
    });
  });

  it('re-upserts a user once when fixture cleanup removes it before session creation', async () => {
    const staleUser = {
      appleUserId: 'mock:concurrent-user',
      avatarUrl: null,
      id: '00000000-0000-4000-8000-000000000010',
      nickname: '旧测试用户',
      timezone: 'Asia/Shanghai',
    };
    const recreatedUser = {
      ...staleUser,
      id: '00000000-0000-4000-8000-000000000011',
      nickname: '重建后的测试用户',
    };
    const session: AuthSession = {
      accessToken: 'retried-access-token',
      accessTokenExpiresAt: '2026-08-01T00:00:00.000Z',
      refreshToken: 'retried-refresh-token',
    };
    const upsertFromApple = vi.fn().mockResolvedValueOnce(staleUser).mockResolvedValueOnce(recreatedUser);
    const create = vi.fn().mockRejectedValueOnce(new SessionUserUnavailableError()).mockResolvedValueOnce(session);
    const userRepository = {
      findById: async () => null,
      updateProfile: async () => recreatedUser,
      upsertFromApple,
    } satisfies UserRepository;
    const authSessionService = {
      create,
      isActive: async () => false,
      revoke: async () => undefined,
      rotate: async () => {
        throw new Error('Not used by this test.');
      },
    } satisfies AuthSessionService;
    const app = createApiApp({ authSessionService, logger: testLogger, userRepository });

    const response = await app.request('/auth/apple', {
      body: JSON.stringify({ identityToken: 'concurrent-user' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user).toMatchObject({ id: recreatedUser.id, nickname: recreatedUser.nickname });
    expect(upsertFromApple).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenNthCalledWith(1, staleUser.id);
    expect(create).toHaveBeenNthCalledWith(2, recreatedUser.id);
  });

  it('rotates refresh sessions and revokes the active session on logout', async () => {
    const app = createTestApp();
    const loginResponse = await app.request('/auth/apple', {
      body: JSON.stringify({ identityToken: 'session-rotation-user' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const loginBody = await loginResponse.json();
    const firstSession = loginBody.data.session;
    const refreshResponse = await app.request('/auth/refresh', {
      body: JSON.stringify({ refreshToken: firstSession.refreshToken }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const refreshBody = await refreshResponse.json();
    const secondSession = refreshBody.data.session;

    expect(refreshResponse.status).toBe(200);
    expect(secondSession.refreshToken).not.toBe(firstSession.refreshToken);
    expect(
      (await app.request('/me', { headers: { authorization: `Bearer ${firstSession.accessToken}` } })).status,
    ).toBe(401);
    expect(
      (await app.request('/me', { headers: { authorization: `Bearer ${secondSession.accessToken}` } })).status,
    ).toBe(200);

    const logoutResponse = await app.request('/auth/logout', {
      body: JSON.stringify({ refreshToken: secondSession.refreshToken }),
      headers: {
        authorization: `Bearer ${secondSession.accessToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    expect(logoutResponse.status).toBe(200);
    expect(
      (await app.request('/me', { headers: { authorization: `Bearer ${secondSession.accessToken}` } })).status,
    ).toBe(401);
  });

  it('returns validation errors for invalid JSON request bodies', async () => {
    const app = createTestApp();
    const response = await app.request('/auth/apple', {
      body: '',
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: 'validation_error',
        message: '请求体不是有效 JSON。',
      },
    });
  });

  it('requires auth for current user information', async () => {
    const app = createTestApp();
    const response = await app.request('/me');
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: 'unauthorized',
        message: '请先登录。',
      },
    });
  });

  it('requires auth for logout', async () => {
    const app = createTestApp();
    const unauthorizedResponse = await app.request('/auth/logout', {
      method: 'POST',
    });
    const unauthorizedBody = await unauthorizedResponse.json();

    expect(unauthorizedResponse.status).toBe(401);
    expect(unauthorizedBody.error.code).toBe('unauthorized');

    const token = await login(app, {
      identityToken: 'logout-token',
    });
    const response = await app.request('/auth/logout', {
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        ok: true,
      },
    });
  });

  it('returns current user information with a token', async () => {
    const app = createTestApp();
    const loginResponse = await app.request('/auth/apple', {
      body: JSON.stringify({
        identityToken: 'apple-test-token',
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const loginBody = await loginResponse.json();
    const response = await app.request('/me', {
      headers: {
        authorization: `Bearer ${loginBody.data.session.accessToken}`,
      },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        avatarUrl: null,
        id: '00000000-0000-4000-8000-000000000001',
        nickname: '小提督用户',
        timezone: 'Asia/Shanghai',
      },
    });
  });

  it('updates current user profile with a token', async () => {
    const app = createTestApp();
    const token = await login(app, {
      identityToken: 'profile-token',
      nickname: '旧昵称',
    });
    const updateResponse = await app.request('/me', {
      body: JSON.stringify({
        avatarUrl: {
          background: 'leaf',
          emoji: 'smile',
        },
        nickname: '好友用户',
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      method: 'PATCH',
    });
    const updateBody = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateBody.data).toMatchObject({
      avatarUrl: {
        background: 'leaf',
        emoji: 'smile',
      },
      nickname: '好友用户',
    });

    const initialAvatarResponse = await app.request('/me', {
      body: JSON.stringify({
        avatarUrl: {
          background: 'rose',
          emoji: null,
        },
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      method: 'PATCH',
    });
    const initialAvatarBody = await initialAvatarResponse.json();

    expect(initialAvatarResponse.status).toBe(200);
    expect(initialAvatarBody.data).toMatchObject({
      avatarUrl: {
        background: 'rose',
        emoji: null,
      },
      nickname: '好友用户',
    });

    const meResponse = await app.request('/me', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const meBody = await meResponse.json();

    expect(meBody.data).toMatchObject({
      avatarUrl: {
        background: 'rose',
        emoji: null,
      },
      nickname: '好友用户',
    });
  });

  it('rejects invalid avatar values', async () => {
    const app = createTestApp();
    const token = await login(app, {
      identityToken: 'invalid-avatar-token',
      nickname: '头像用户',
    });
    const urlResponse = await app.request('/me', {
      body: JSON.stringify({
        avatarUrl: 'https://example.com/avatar.jpg',
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      method: 'PATCH',
    });
    const urlBody = await urlResponse.json();
    const unknownEmojiResponse = await app.request('/me', {
      body: JSON.stringify({
        avatarUrl: {
          background: 'leaf',
          emoji: 'not_a_preset',
        },
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      method: 'PATCH',
    });
    const unknownEmojiBody = await unknownEmojiResponse.json();
    const unknownBackgroundResponse = await app.request('/me', {
      body: JSON.stringify({
        avatarUrl: {
          background: 'glitter',
          emoji: 'smile',
        },
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      method: 'PATCH',
    });
    const unknownBackgroundBody = await unknownBackgroundResponse.json();

    expect(urlResponse.status).toBe(400);
    expect(urlBody.error.code).toBe('validation_error');
    expect(unknownEmojiResponse.status).toBe(400);
    expect(unknownEmojiBody.error.code).toBe('validation_error');
    expect(unknownBackgroundResponse.status).toBe(400);
    expect(unknownBackgroundBody.error.code).toBe('validation_error');
  });

  it('requires auth for entitlements and returns mock entitlements with a token', async () => {
    const app = createTestApp();
    const unauthorizedResponse = await app.request('/me/entitlements');
    const unauthorizedBody = await unauthorizedResponse.json();

    expect(unauthorizedResponse.status).toBe(401);
    expect(unauthorizedBody.error.code).toBe('unauthorized');

    const loginResponse = await app.request('/auth/apple', {
      body: JSON.stringify({
        identityToken: 'apple-test-token',
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const loginBody = await loginResponse.json();
    const authorizedResponse = await app.request('/me/entitlements', {
      headers: {
        authorization: `Bearer ${loginBody.data.session.accessToken}`,
      },
    });
    const body = await authorizedResponse.json();

    expect(authorizedResponse.status).toBe(200);
    expect(body).toEqual({
      data: {
        proStatus: 'free',
      },
    });
  });

  it('syncs complete records for free authenticated users and isolates unauthenticated access', async () => {
    const app = createTestApp();
    expect((await app.request('/data-sync/pull?cursor=0')).status).toBe(401);

    const token = await login(app, { identityToken: 'full-data-sync-user' });
    const mutation = {
      changedAt: '2026-07-21T08:00:00.000Z',
      entityId: '2026-07-21',
      entityType: 'habit_checkin',
      mutationId: 'mutation-route-1',
      operation: 'upsert',
      payload: {
        bowel: 'good',
        date: '2026-07-21',
        fiber: 'medium',
        movement: 'good',
        water: 'low',
      },
    };
    const pushResponse = await app.request('/data-sync/push', {
      body: JSON.stringify({ mutations: [mutation], timeZone: 'Asia/Shanghai' }),
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      method: 'PUT',
    });
    const pullResponse = await app.request('/data-sync/pull?cursor=0', {
      headers: { authorization: `Bearer ${token}` },
    });
    const pushed = await pushResponse.json();
    const pulled = await pullResponse.json();

    expect(pushResponse.status).toBe(200);
    expect(pushed.data.acceptedMutationIds).toEqual(['mutation-route-1']);
    expect(pullResponse.status).toBe(200);
    expect(pulled.data.changes).toHaveLength(1);
    expect(pulled.data.changes[0]).toMatchObject({
      entityId: '2026-07-21',
      entityType: 'habit_checkin',
      operation: 'upsert',
    });
  });

  it('returns structured database-not-configured errors', async () => {
    const app = createApiApp({
      databaseHealthChecker: () => checkDatabaseHealth({ DB_SSL: false }),
      logger: testLogger,
    });
    const response = await app.request('/health/db');
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        code: 'database_not_configured',
        message: '数据库连接还没有配置。',
      },
    });
  });

  it('returns database health information when the database is reachable', async () => {
    const appWithDatabase = createApiApp({
      databaseHealthChecker: async () => ({
        database: 'reachable',
        ok: true,
      }),
      logger: testLogger,
    });
    const response = await appWithDatabase.request('/health/db');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        database: 'reachable',
        ok: true,
      },
    });
  });

  it('returns structured database-unreachable errors', async () => {
    const appWithDatabaseFailure = createApiApp({
      databaseHealthChecker: async () => {
        throw new ApiError(503, 'database_unreachable', '数据库暂时不可用。');
      },
      logger: testLogger,
    });
    const response = await appWithDatabaseFailure.request('/health/db');
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        code: 'database_unreachable',
        message: '数据库暂时不可用。',
      },
    });
  });

  it('returns structured not found errors', async () => {
    const app = createTestApp();
    const response = await app.request('/missing');
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: 'not_found',
        message: '没有找到这个接口。',
      },
    });
  });

  it('protects Pro report routes and returns advanced report data for Pro users', async () => {
    const proEntitlementsService: EntitlementsService = {
      async getEntitlements() {
        return {
          proStatus: 'pro_active',
        };
      },
    };
    const reportService: ReportService = {
      async getAdvancedReport(_currentUser, range) {
        const snapshot = createDailyReportSnapshot({
          date: '2026-05-22',
          streakDays: 8,
        });

        return {
          days: [
            {
              date: snapshot.date,
              habitCompletion: snapshot.habitCompletion,
              habitFull: snapshot.habitCompletion === 4,
              toiletLongMeeting: snapshot.toiletLongMeeting,
              toiletRecorded: snapshot.toiletRecorded,
              trainingDone: snapshot.trainingDone,
            },
          ],
          endedAt: snapshot.date,
          range,
          snapshot,
          startedAt: '2026-02-22',
          summaries: repeatAdvancedSummary({
            currentStreakDays: snapshot.streakDays,
            habitFullDays: 20,
            hasAnyRecord: true,
            recordDays: 31,
            toiletLongMeetingCount: 2,
            toiletRecordDays: 20,
            trainingDays: 31,
          }),
        };
      },
      async upsertDailyReportSnapshot(_currentUser, snapshot) {
        return {
          snapshot,
        };
      },
      async upsertDailyReportSnapshots(_currentUser, snapshots) {
        return {
          snapshots,
        };
      },
    };
    const freeApp = createTestApp();
    const freeToken = await login(freeApp);
    const freeResponse = await freeApp.request('/reports/advanced?range=90d', {
      headers: {
        authorization: `Bearer ${freeToken}`,
      },
    });
    const freeBody = await freeResponse.json();

    expect(freeResponse.status).toBe(403);
    expect(freeBody.error.code).toBe('forbidden');

    const proApp = createApiApp({
      entitlementsService: proEntitlementsService,
      logger: testLogger,
      reportService,
    });
    const unauthorizedResponse = await proApp.request('/reports/advanced?range=90d');
    const unauthorizedBody = await unauthorizedResponse.json();

    expect(unauthorizedResponse.status).toBe(401);
    expect(unauthorizedBody.error.code).toBe('unauthorized');

    const proToken = await login(proApp, {
      identityToken: 'pro-report-token',
    });
    const response = await proApp.request('/reports/advanced?range=90d', {
      headers: {
        authorization: `Bearer ${proToken}`,
      },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      range: '90d',
      snapshot: {
        date: '2026-05-22',
        habitCompletion: 4,
      },
    });
  });

  it('upserts a Pro daily report snapshot and reads it back', async () => {
    const proEntitlementsService: EntitlementsService = {
      async getEntitlements() {
        return {
          proStatus: 'pro_active',
        };
      },
    };
    const app = createApiApp({
      entitlementsService: proEntitlementsService,
      logger: testLogger,
    });
    const token = await login(app, {
      identityToken: 'report-snapshot-token',
    });
    const snapshot = createDailyReportSnapshot();
    const upsertResponse = await app.request('/report-snapshots/today', {
      body: JSON.stringify({ snapshot }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      method: 'PUT',
    });
    const upsertBody = await upsertResponse.json();

    expect(upsertResponse.status).toBe(200);
    expect(upsertBody.data.snapshot).toEqual(snapshot);

    const reportResponse = await app.request('/reports/advanced?range=90d', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const reportBody = await reportResponse.json();

    expect(reportResponse.status).toBe(200);
    expect(reportBody.data.snapshot).toEqual(snapshot);
    expect(reportBody.data.days).toHaveLength(90);
    expect(reportBody.data.days.at(-1)).toMatchObject({
      date: snapshot.date,
      habitFull: true,
      trainingDone: true,
    });
    expect(reportBody.data.summaries['90d']).toMatchObject({
      currentStreakDays: 9,
      habitFullDays: 1,
      hasAnyRecord: true,
      recordDays: 1,
      toiletLongMeetingCount: 0,
      toiletRecordDays: 1,
      trainingDays: 1,
    });
  });

  it('bulk upserts Pro report snapshots with 90-day validation and duplicate date handling', async () => {
    const snapshotDate = getTestDateKey();
    const previousDate = addDaysToDateKey(snapshotDate, -1);
    const freeApp = createTestApp();
    const freeToken = await login(freeApp, {
      identityToken: 'bulk-report-free-token',
    });
    const freeResponse = await freeApp.request('/report-snapshots/bulk', {
      body: JSON.stringify({
        snapshots: [createDailyReportSnapshot({ date: snapshotDate })],
      }),
      headers: {
        authorization: `Bearer ${freeToken}`,
        'content-type': 'application/json',
      },
      method: 'PUT',
    });

    expect(freeResponse.status).toBe(403);

    const app = createApiApp({
      entitlementsService: proEntitlementsService,
      logger: testLogger,
    });
    const token = await login(app, {
      identityToken: 'bulk-report-pro-token',
    });
    const staleSnapshot = createDailyReportSnapshot({
      date: previousDate,
      habitCompletion: 1,
      toiletRecorded: false,
      trainingDone: false,
    });
    const latestPreviousSnapshot = createDailyReportSnapshot({
      date: previousDate,
      habitCompletion: 4,
    });
    const latestSnapshot = createDailyReportSnapshot({
      date: snapshotDate,
      streakDays: 2,
      toiletLongMeeting: true,
    });
    const bulkResponse = await app.request('/report-snapshots/bulk', {
      body: JSON.stringify({
        snapshots: [staleSnapshot, latestPreviousSnapshot, latestSnapshot],
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      method: 'PUT',
    });
    const bulkBody = await bulkResponse.json();

    expect(bulkResponse.status).toBe(200);
    expect(bulkBody.data.snapshots).toHaveLength(2);
    expect(bulkBody.data.snapshots[0]).toMatchObject({
      date: previousDate,
      habitCompletion: 4,
    });

    const reportResponse = await app.request('/reports/advanced?range=90d', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const reportBody = await reportResponse.json();
    const previousDay = reportBody.data.days.find((day: { date: string }) => day.date === previousDate);

    expect(reportResponse.status).toBe(200);
    expect(reportBody.data.days).toHaveLength(90);
    expect(previousDay).toMatchObject({
      habitFull: true,
      trainingDone: true,
    });
    expect(reportBody.data.summaries['90d']).toMatchObject({
      currentStreakDays: 2,
      habitFullDays: 2,
      recordDays: 2,
      toiletLongMeetingCount: 1,
      trainingDays: 2,
    });

    const oversizedResponse = await app.request('/report-snapshots/bulk', {
      body: JSON.stringify({
        snapshots: Array.from({ length: 91 }, () => latestSnapshot),
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      method: 'PUT',
    });
    const oversizedBody = await oversizedResponse.json();

    expect(oversizedResponse.status).toBe(400);
    expect(oversizedBody.error.code).toBe('validation_error');
  });

  it('returns pending subscription verification placeholders', async () => {
    const app = createTestApp();
    const token = await login(app, {
      identityToken: 'subscription-token',
    });
    const verifyResponse = await app.request('/subscriptions/verify', {
      body: JSON.stringify({
        productId: 'xiaotidu.pro.monthly',
        transactionId: 'tx-test',
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const verifyBody = await verifyResponse.json();

    expect(verifyResponse.status).toBe(200);
    expect(verifyBody.data).toEqual({
      entitlements: {
        proStatus: 'free',
      },
      status: 'pending_verification',
    });

    const restoreResponse = await app.request('/subscriptions/restore', {
      body: JSON.stringify({
        transactionIds: ['tx-test'],
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const restoreBody = await restoreResponse.json();

    expect(restoreResponse.status).toBe(200);
    expect(restoreBody.data.status).toBe('pending_verification');
  });
});

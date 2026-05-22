import { describe, expect, it } from 'vitest';

import type { TeamMember } from '@xiaotidu/contracts';

import { createApiApp } from '../app.js';
import { ApiError } from '../http/apiError.js';
import { createLogger } from '../lib/logger.js';
import type { EntitlementsService } from '../modules/entitlements/entitlementsService.js';
import type { PushNotificationPayload } from '../modules/push/pushNotificationService.js';
import { createMockNudgeService } from '../modules/nudges/nudgeService.js';
import type { ReportService } from '../modules/reports/reportService.js';
import { createMockTeamService } from '../modules/teams/teamService.js';

const testLogger = createLogger({
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
});

function createTestApp() {
  return createApiApp({ logger: testLogger });
}

const proEntitlementsService: EntitlementsService = {
  async getEntitlements() {
    return {
      proStatus: 'pro_active',
    };
  },
};

function createProTestApp(options: Parameters<typeof createApiApp>[0] = {}) {
  return createApiApp({
    entitlementsService: proEntitlementsService,
    logger: testLogger,
    ...options,
  });
}

async function login(
  app: ReturnType<typeof createApiApp>,
  input: { identityToken?: string; nickname?: string } = {},
) {
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

  return loginBody.data.token as string;
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
    expect(body.data.token).toEqual(expect.any(String));
    expect(body).toEqual({
      data: {
        token: body.data.token,
        user: {
          avatarUrl: null,
          id: '00000000-0000-4000-8000-000000000001',
          nickname: '测试用户',
          timezone: 'Asia/Shanghai',
        },
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
        authorization: `Bearer ${loginBody.data.token}`,
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
        authorization: `Bearer ${loginBody.data.token}`,
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

  it('returns structured database-not-configured errors', async () => {
    const app = createTestApp();
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
        return {
          range,
          snapshot: {
            date: '2026-05-22',
            habitCompletion: 4,
            habitFull: true,
            ninetyDayHabitFullDays: 20,
            ninetyDayToiletLongMeetingCount: 2,
            ninetyDayTrainingDays: 31,
            streakDays: 8,
            thirtyDayHabitFullDays: 9,
            thirtyDayToiletLongMeetingCount: 1,
            thirtyDayTrainingDays: 12,
            toiletLongMeeting: false,
            toiletRecorded: true,
            trainingDone: true,
            weeklyHabitFullDays: 3,
            weeklyToiletLongMeetingCount: 0,
            weeklyTrainingDays: 4,
          },
        };
      },
      async getTeamWeeklyReport() {
        return {
          endedAt: '2026-05-22',
          memberCount: 0,
          startedAt: '2026-05-16',
          summaries: [],
        };
      },
      async upsertDailyReportSnapshot(_currentUser, snapshot) {
        return {
          snapshot,
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
        habitFull: true,
        weeklyTrainingDays: 4,
      },
    });
  });

  it('returns a Pro team weekly report', async () => {
    const proEntitlementsService: EntitlementsService = {
      async getEntitlements() {
        return {
          proStatus: 'pro_grace_period',
        };
      },
    };
    const reportService: ReportService = {
      async getAdvancedReport() {
        return {
          range: '90d',
          snapshot: null,
        };
      },
      async getTeamWeeklyReport(currentUser) {
        return {
          endedAt: '2026-05-22',
          memberCount: 1,
          startedAt: '2026-05-16',
          summaries: [
            {
              habitFullDays: 3,
              member: {
                displayName: '小队长',
                id: 'member-1',
                user: {
                  avatarUrl: null,
                  id: currentUser.id,
                  nickname: currentUser.nickname,
                },
              },
              toiletRecordedDays: 2,
              trainingDays: 4,
            },
          ],
        };
      },
      async upsertDailyReportSnapshot(_currentUser, snapshot) {
        return {
          snapshot,
        };
      },
    };
    const app = createApiApp({
      entitlementsService: proEntitlementsService,
      logger: testLogger,
      reportService,
    });
    const token = await login(app, {
      identityToken: 'weekly-report-token',
      nickname: '周报用户',
    });
    const response = await app.request('/teams/current/reports/weekly', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      endedAt: '2026-05-22',
      memberCount: 1,
      startedAt: '2026-05-16',
      summaries: [
        {
          habitFullDays: 3,
          member: {
            displayName: '小队长',
            id: 'member-1',
            user: {
              avatarUrl: null,
              id: '00000000-0000-4000-8000-000000000001',
              nickname: '周报用户',
            },
          },
          toiletRecordedDays: 2,
          trainingDays: 4,
        },
      ],
    });
  });

  it('filters team weekly report by member share settings', async () => {
    const app = createProTestApp();
    const ownerToken = await login(app, {
      identityToken: 'weekly-owner-token',
      nickname: '队长',
    });

    await app.request('/teams', {
      body: JSON.stringify({
        name: '周报隐私队',
      }),
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    const inviteResponse = await app.request('/teams/current/invites', {
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      method: 'POST',
    });
    const inviteBody = await inviteResponse.json();
    const buddyToken = await login(app, {
      identityToken: 'weekly-buddy-token',
      nickname: '搭子',
    });

    await app.request(`/team-invites/${inviteBody.data.token}/accept`, {
      body: JSON.stringify({
        shareSettings: {
          shareHabitCompletion: false,
          shareToiletRecorded: false,
          shareTraining: false,
        },
      }),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    const today = new Date().toISOString().slice(0, 10);

    await app.request('/share-snapshots/today', {
      body: JSON.stringify({
        snapshot: {
          date: today,
          habitCompletion: 4,
          streakDays: 7,
          toiletRecorded: true,
          trainingDone: true,
        },
      }),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'PUT',
    });

    const reportResponse = await app.request('/teams/current/reports/weekly', {
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
    });
    const reportBody = await reportResponse.json();
    const buddySummary = reportBody.data.summaries.find(
      (summary: { member: { user: { nickname: string } } }) => summary.member.user.nickname === '搭子',
    );

    expect(reportResponse.status).toBe(200);
    expect(buddySummary).toMatchObject({
      habitFullDays: 0,
      toiletRecordedDays: 0,
      trainingDays: 0,
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
    const snapshot = {
      date: '2026-05-22',
      habitCompletion: 4,
      habitFull: true,
      ninetyDayHabitFullDays: 24,
      ninetyDayToiletLongMeetingCount: 2,
      ninetyDayTrainingDays: 36,
      streakDays: 9,
      thirtyDayHabitFullDays: 10,
      thirtyDayToiletLongMeetingCount: 1,
      thirtyDayTrainingDays: 13,
      toiletLongMeeting: false,
      toiletRecorded: true,
      trainingDone: true,
      weeklyHabitFullDays: 4,
      weeklyToiletLongMeetingCount: 0,
      weeklyTrainingDays: 5,
    };
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

  it('requires auth for team routes', async () => {
    const app = createTestApp();
    const response = await app.request('/teams/current');
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('unauthorized');
  });

  it('requires Pro to create a team', async () => {
    const app = createTestApp();
    const token = await login(app, {
      identityToken: 'free-team-token',
    });
    const response = await app.request('/teams', {
      body: JSON.stringify({
        name: '免费用户小队',
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('forbidden');
  });

  it('creates a team and exposes low-sensitivity team snapshots', async () => {
    const appWithTeams = createProTestApp();
    const token = await login(appWithTeams);
    const authHeaders = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };

    const emptyTeamResponse = await appWithTeams.request('/teams/current', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const emptyTeamBody = await emptyTeamResponse.json();

    expect(emptyTeamResponse.status).toBe(200);
    expect(emptyTeamBody).toEqual({
      data: {
        team: null,
      },
    });

    const createTeamResponse = await appWithTeams.request('/teams', {
      body: JSON.stringify({
        name: '轻轻监督队',
      }),
      headers: authHeaders,
      method: 'POST',
    });
    const createTeamBody = await createTeamResponse.json();

    expect(createTeamResponse.status).toBe(200);
    expect(createTeamBody.data.team).toMatchObject({
      members: [
        {
          displayName: '小提督用户',
          role: 'owner',
          status: 'active',
          user: {
            id: '00000000-0000-4000-8000-000000000001',
          },
        },
      ],
      name: '轻轻监督队',
      ownerUserId: '00000000-0000-4000-8000-000000000001',
    });

    const shareSettingsResponse = await appWithTeams.request('/share-settings', {
      body: JSON.stringify({
        paused: false,
        shareHabitCompletion: false,
        shareStreak: true,
        shareToiletRecorded: true,
        shareTraining: true,
      }),
      headers: authHeaders,
      method: 'PUT',
    });
    const shareSettingsBody = await shareSettingsResponse.json();

    expect(shareSettingsResponse.status).toBe(200);
    expect(shareSettingsBody.data.settings.shareHabitCompletion).toBe(false);

    const snapshotResponse = await appWithTeams.request('/share-snapshots/today', {
      body: JSON.stringify({
        snapshot: {
          date: '2026-05-22',
          habitCompletion: 3,
          streakDays: 6,
          toiletRecorded: true,
          trainingDone: true,
        },
      }),
      headers: authHeaders,
      method: 'PUT',
    });
    const snapshotBody = await snapshotResponse.json();

    expect(snapshotResponse.status).toBe(200);
    expect(snapshotBody.data.snapshot).toEqual({
      date: '2026-05-22',
      habitCompletion: 3,
      streakDays: 6,
      toiletRecorded: true,
      trainingDone: true,
    });

    const snapshotsResponse = await appWithTeams.request('/teams/current/snapshots?date=2026-05-22', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const snapshotsBody = await snapshotsResponse.json();

    expect(snapshotsResponse.status).toBe(200);
    expect(snapshotsBody).toEqual({
      data: {
        date: '2026-05-22',
        snapshots: [
          {
            member: createTeamBody.data.team.members[0],
            shareSettings: {
              paused: false,
              shareHabitCompletion: false,
              shareStreak: true,
              shareToiletRecorded: true,
              shareTraining: true,
            },
            snapshot: {
              date: '2026-05-22',
              streakDays: 6,
              toiletRecorded: true,
              trainingDone: true,
            },
          },
        ],
      },
    });
  });

  it('creates, previews, and accepts a team invite', async () => {
    const appWithInvites = createProTestApp();
    const ownerToken = await login(appWithInvites, {
      identityToken: 'owner-token',
      nickname: '队长',
    });
    const ownerHeaders = {
      authorization: `Bearer ${ownerToken}`,
      'content-type': 'application/json',
    };

    await appWithInvites.request('/teams', {
      body: JSON.stringify({
        name: '不卷小队',
      }),
      headers: ownerHeaders,
      method: 'POST',
    });

    const inviteResponse = await appWithInvites.request('/teams/current/invites', {
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      method: 'POST',
    });
    const inviteBody = await inviteResponse.json();

    expect(inviteResponse.status).toBe(200);
    expect(inviteBody.data).toEqual({
      expiresAt: expect.any(String),
      inviteId: expect.any(String),
      inviteUrl: `xiaotidu://team-invites/${inviteBody.data.token}`,
      token: expect.any(String),
    });

    const previewResponse = await appWithInvites.request(`/team-invites/${inviteBody.data.token}`);
    const previewBody = await previewResponse.json();

    expect(previewResponse.status).toBe(200);
    expect(previewBody.data).toEqual({
      expiresAt: inviteBody.data.expiresAt,
      inviterNickname: '队长',
      teamName: '不卷小队',
    });

    const buddyToken = await login(appWithInvites, {
      identityToken: 'buddy-token',
      nickname: '搭子',
    });
    const acceptResponse = await appWithInvites.request(`/team-invites/${inviteBody.data.token}/accept`, {
      body: JSON.stringify({
        displayName: '监督搭子',
        shareSettings: {
          shareToiletRecorded: false,
        },
      }),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const acceptBody = await acceptResponse.json();

    expect(acceptResponse.status).toBe(200);
    expect(acceptBody.data.team.members).toHaveLength(2);
    expect(acceptBody.data.team.members[1]).toMatchObject({
      displayName: '监督搭子',
      role: 'buddy',
      status: 'active',
      user: {
        nickname: '搭子',
      },
    });

    const secondAcceptResponse = await appWithInvites.request(`/team-invites/${inviteBody.data.token}/accept`, {
      body: JSON.stringify({}),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const secondAcceptBody = await secondAcceptResponse.json();

    expect(secondAcceptResponse.status).toBe(409);
    expect(secondAcceptBody.error.code).toBe('conflict');
  });

  it('updates team name, pauses sharing, removes a member, and leaves a team', async () => {
    const appWithTeamManagement = createProTestApp();
    const ownerToken = await login(appWithTeamManagement, {
      identityToken: 'manage-owner-token',
      nickname: '队长',
    });
    const ownerHeaders = {
      authorization: `Bearer ${ownerToken}`,
      'content-type': 'application/json',
    };

    await appWithTeamManagement.request('/teams', {
      body: JSON.stringify({
        name: '旧名字',
      }),
      headers: ownerHeaders,
      method: 'POST',
    });

    const renameResponse = await appWithTeamManagement.request('/teams/current', {
      body: JSON.stringify({
        name: '新名字',
      }),
      headers: ownerHeaders,
      method: 'PATCH',
    });
    const renameBody = await renameResponse.json();

    expect(renameResponse.status).toBe(200);
    expect(renameBody.data.team.name).toBe('新名字');

    const inviteResponse = await appWithTeamManagement.request('/teams/current/invites', {
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      method: 'POST',
    });
    const inviteBody = await inviteResponse.json();
    const buddyToken = await login(appWithTeamManagement, {
      identityToken: 'manage-buddy-token',
      nickname: '搭子',
    });

    const acceptResponse = await appWithTeamManagement.request(`/team-invites/${inviteBody.data.token}/accept`, {
      body: JSON.stringify({}),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const acceptBody = await acceptResponse.json();
    const buddyMember = acceptBody.data.team.members.find((member: TeamMember) => member.role === 'buddy');

    expect(buddyMember).toBeTruthy();

    const pauseResponse = await appWithTeamManagement.request('/teams/current/members/me/status', {
      body: JSON.stringify({
        status: 'paused',
      }),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'PATCH',
    });
    const pauseBody = await pauseResponse.json();

    expect(pauseResponse.status).toBe(200);
    expect(pauseBody.data.team.members[1].status).toBe('paused');

    const removeResponse = await appWithTeamManagement.request(`/teams/current/members/${buddyMember.id}`, {
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      method: 'DELETE',
    });
    const removeBody = await removeResponse.json();

    expect(removeResponse.status).toBe(200);
    expect(removeBody.data.team.members).toHaveLength(1);

    const buddyTeamResponse = await appWithTeamManagement.request('/teams/current', {
      headers: {
        authorization: `Bearer ${buddyToken}`,
      },
    });
    const buddyTeamBody = await buddyTeamResponse.json();

    expect(buddyTeamResponse.status).toBe(200);
    expect(buddyTeamBody.data.team).toBeNull();

    const leaveResponse = await appWithTeamManagement.request('/teams/current/leave', {
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      method: 'POST',
    });
    const leaveBody = await leaveResponse.json();

    expect(leaveResponse.status).toBe(200);
    expect(leaveBody.data.team).toBeNull();
  });

  it('sends buddy nudges, applies settings, records acks, and registers push tokens', async () => {
    const sentNotifications: PushNotificationPayload[] = [];
    const teamService = createMockTeamService();
    const appWithNudges = createProTestApp({
      logger: testLogger,
      nudgeService: createMockNudgeService({
        pushNotificationService: {
          async sendToUser(payload) {
            sentNotifications.push(payload);
          },
        },
        teamService,
      }),
      teamService,
    });
    const ownerToken = await login(appWithNudges, {
      identityToken: 'nudge-owner-token',
      nickname: '队长',
    });

    await appWithNudges.request('/teams', {
      body: JSON.stringify({
        name: '互相轻戳队',
      }),
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    const inviteResponse = await appWithNudges.request('/teams/current/invites', {
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      method: 'POST',
    });
    const inviteBody = await inviteResponse.json();
    const buddyToken = await login(appWithNudges, {
      identityToken: 'nudge-buddy-token',
      nickname: '搭子',
    });
    const acceptResponse = await appWithNudges.request(`/team-invites/${inviteBody.data.token}/accept`, {
      body: JSON.stringify({}),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const acceptBody = await acceptResponse.json();
    const ownerMember = acceptBody.data.team.members.find((member: TeamMember) => member.role === 'owner');
    const buddyMember = acceptBody.data.team.members.find((member: TeamMember) => member.role === 'buddy');

    const pushTokenResponse = await appWithNudges.request('/push-tokens', {
      body: JSON.stringify({
        deviceId: 'test-device',
        platform: 'ios',
        provider: 'expo',
        token: 'ExponentPushToken[test]',
      }),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const pushTokenBody = await pushTokenResponse.json();

    expect(pushTokenResponse.status).toBe(200);
    expect(pushTokenBody.data.id).toEqual(expect.any(String));

    const nudgeResponse = await appWithNudges.request('/nudges', {
      body: JSON.stringify({
        toUserId: buddyMember.user.id,
        type: 'move',
      }),
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const nudgeBody = await nudgeResponse.json();

    expect(nudgeResponse.status).toBe(200);
    expect(nudgeBody.data).toMatchObject({
      ack: null,
      fromUser: {
        nickname: '队长',
      },
      messageTemplate: '起来活动一下，换个姿势。',
      toUser: {
        nickname: '搭子',
      },
      type: 'move',
    });
    expect(sentNotifications[0]).toEqual({
      body: '起来活动一下，换个姿势。',
      data: {
        kind: 'buddy-nudge',
        nudgeId: nudgeBody.data.id,
        teamId: nudgeBody.data.teamId,
        type: 'move',
      },
      title: '搭子轻轻戳了你一下',
      userId: buddyMember.user.id,
    });

    const inboxResponse = await appWithNudges.request('/nudges/inbox', {
      headers: {
        authorization: `Bearer ${buddyToken}`,
      },
    });
    const inboxBody = await inboxResponse.json();

    expect(inboxResponse.status).toBe(200);
    expect(inboxBody.data.nudges).toHaveLength(1);

    const ackResponse = await appWithNudges.request(`/nudges/${nudgeBody.data.id}/ack`, {
      body: JSON.stringify({
        status: 'received',
      }),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const ackBody = await ackResponse.json();

    expect(ackResponse.status).toBe(200);
    expect(ackBody.data.ack).toMatchObject({
      revisionCount: 0,
      status: 'received',
    });
    expect(sentNotifications[1]).toEqual({
      body: '对方说收到了。',
      data: {
        kind: 'buddy-nudge-ack',
        nudgeId: nudgeBody.data.id,
        status: 'received',
      },
      title: '搭子有回音了',
      userId: ownerMember.user.id,
    });

    const editAckResponse = await appWithNudges.request(`/nudges/${nudgeBody.data.id}/ack`, {
      body: JSON.stringify({
        status: 'done',
      }),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const editAckBody = await editAckResponse.json();

    expect(editAckResponse.status).toBe(200);
    expect(editAckBody.data.ack).toMatchObject({
      revisionCount: 1,
      status: 'done',
    });

    const thirdAckResponse = await appWithNudges.request(`/nudges/${nudgeBody.data.id}/ack`, {
      body: JSON.stringify({
        status: 'later',
      }),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const thirdAckBody = await thirdAckResponse.json();

    expect(thirdAckResponse.status).toBe(409);
    expect(thirdAckBody.error.code).toBe('conflict');

    const settingsResponse = await appWithNudges.request(`/buddy-nudge-settings/${ownerMember.user.id}`, {
      body: JSON.stringify({
        dailyLimit: 5,
        enabled: true,
        quietRanges: [
          {
            end: '00:00',
            start: '00:00',
          },
        ],
      }),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'PUT',
    });
    const settingsBody = await settingsResponse.json();

    expect(settingsResponse.status).toBe(200);
    expect(settingsBody.data.settings[0]).toMatchObject({
      buddyUserId: ownerMember.user.id,
      dailyLimit: 5,
      enabled: true,
      userId: buddyMember.user.id,
    });

    const quietNudgeResponse = await appWithNudges.request('/nudges', {
      body: JSON.stringify({
        toUserId: buddyMember.user.id,
        type: 'gentle',
      }),
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const quietNudgeBody = await quietNudgeResponse.json();

    expect(quietNudgeResponse.status).toBe(403);
    expect(quietNudgeBody.error.code).toBe('forbidden');

    const disabledSettingsResponse = await appWithNudges.request(`/buddy-nudge-settings/${ownerMember.user.id}`, {
      body: JSON.stringify({
        dailyLimit: 0,
        enabled: false,
        quietRanges: [],
      }),
      headers: {
        authorization: `Bearer ${buddyToken}`,
        'content-type': 'application/json',
      },
      method: 'PUT',
    });
    const disabledSettingsBody = await disabledSettingsResponse.json();

    expect(disabledSettingsResponse.status).toBe(200);
    expect(disabledSettingsBody.data.settings[0]).toMatchObject({
      buddyUserId: ownerMember.user.id,
      dailyLimit: 0,
      enabled: false,
      userId: buddyMember.user.id,
    });

    const blockedNudgeResponse = await appWithNudges.request('/nudges', {
      body: JSON.stringify({
        toUserId: buddyMember.user.id,
        type: 'gentle',
      }),
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const blockedNudgeBody = await blockedNudgeResponse.json();

    expect(blockedNudgeResponse.status).toBe(403);
    expect(blockedNudgeBody.error.code).toBe('forbidden');
  });
});

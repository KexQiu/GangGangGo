import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import * as contracts from '@xiaotidu/contracts';

type Operation = {
  method: 'delete' | 'get' | 'patch' | 'post' | 'put';
  path: string;
  request?: keyof typeof schemas;
  response: keyof typeof schemas;
  security?: boolean;
  summary: string;
};

const okSchema = z.object({ ok: z.literal(true) });
const schemas = {
  AcceptTeamInviteRequest: contracts.acceptTeamInviteRequestSchema,
  AdvancedReportResponse: contracts.advancedReportResponseSchema,
  AppleLoginRequest: contracts.appleLoginRequestSchema,
  AuthResponse: contracts.authResponseSchema,
  BuddyNudge: contracts.buddyNudgeSchema,
  BuddyNudgeAckRequest: contracts.ackBuddyNudgeRequestSchema,
  BuddyNudgeAckResponse: contracts.buddyNudgeAckResponseSchema,
  BuddyNudgeSettingsRequest: contracts.updateBuddyNudgeSettingsRequestSchema,
  BuddyNudgeSettingsResponse: contracts.buddyNudgeSettingsResponseSchema,
  BuddyNudgeThreadResponse: contracts.buddyNudgeThreadResponseSchema,
  BuddyNudgesResponse: contracts.buddyNudgesResponseSchema,
  CreateBuddyNudgeRequest: contracts.createBuddyNudgeRequestSchema,
  CreateTeamInviteResponse: contracts.createTeamInviteResponseSchema,
  CreateTeamRequest: contracts.createTeamRequestSchema,
  DailyReportBulkRequest: contracts.upsertDailyReportSnapshotsBulkRequestSchema,
  DailyReportBulkResponse: contracts.dailyReportSnapshotsBulkResponseSchema,
  DailyReportRequest: contracts.upsertDailyReportSnapshotRequestSchema,
  DailyReportResponse: contracts.dailyReportSnapshotResponseSchema,
  DailyShareRequest: contracts.upsertDailyShareSnapshotRequestSchema,
  DailyShareResponse: contracts.dailyShareSnapshotResponseSchema,
  EntitlementsResponse: contracts.entitlementsResponseSchema,
  HealthResponse: contracts.apiHealthResponseSchema,
  LogoutRequest: contracts.logoutRequestSchema,
  NudgeThreadsResponse: contracts.nudgeThreadsResponseSchema,
  OkResponse: okSchema,
  PushTokenRequest: contracts.registerPushTokenRequestSchema,
  PushTokenResponse: contracts.registerPushTokenResponseSchema,
  RefreshSessionRequest: contracts.refreshSessionRequestSchema,
  RestoreSubscriptionRequest: contracts.restoreSubscriptionRequestSchema,
  ShareSettings: contracts.shareSettingsSchema,
  ShareSettingsResponse: contracts.shareSettingsResponseSchema,
  SubscriptionActionResponse: contracts.subscriptionActionResponseSchema,
  TeamInvitePreviewResponse: contracts.teamInvitePreviewResponseSchema,
  TeamResponse: contracts.teamResponseSchema,
  TeamSnapshotsResponse: contracts.teamSnapshotsResponseSchema,
  TeamWeeklyReportResponse: contracts.teamWeeklyReportResponseSchema,
  UpdateMemberStatusRequest: contracts.updateTeamMemberStatusRequestSchema,
  UpdateTeamRequest: contracts.updateTeamRequestSchema,
  UpdateUserProfileRequest: contracts.updateUserProfileRequestSchema,
  UserProfile: contracts.userProfileSchema,
  VerifySubscriptionRequest: contracts.verifySubscriptionRequestSchema,
} as const;

const operations: Operation[] = [
  { method: 'get', path: '/health', response: 'HealthResponse', summary: '服务健康检查' },
  {
    method: 'post',
    path: '/auth/apple',
    request: 'AppleLoginRequest',
    response: 'AuthResponse',
    summary: 'Apple 或开发 Mock 登录',
  },
  {
    method: 'post',
    path: '/auth/refresh',
    request: 'RefreshSessionRequest',
    response: 'AuthResponse',
    summary: '轮换登录会话',
  },
  {
    method: 'post',
    path: '/auth/logout',
    request: 'LogoutRequest',
    response: 'OkResponse',
    security: true,
    summary: '撤销当前会话',
  },
  { method: 'get', path: '/me', response: 'UserProfile', security: true, summary: '当前用户' },
  {
    method: 'patch',
    path: '/me',
    request: 'UpdateUserProfileRequest',
    response: 'UserProfile',
    security: true,
    summary: '更新用户资料',
  },
  { method: 'get', path: '/me/entitlements', response: 'EntitlementsResponse', security: true, summary: '会员权益' },
  {
    method: 'post',
    path: '/teams',
    request: 'CreateTeamRequest',
    response: 'TeamResponse',
    security: true,
    summary: '创建小队',
  },
  { method: 'get', path: '/teams/current', response: 'TeamResponse', security: true, summary: '当前小队' },
  {
    method: 'patch',
    path: '/teams/current',
    request: 'UpdateTeamRequest',
    response: 'TeamResponse',
    security: true,
    summary: '更新小队',
  },
  { method: 'post', path: '/teams/current/leave', response: 'TeamResponse', security: true, summary: '退出小队' },
  {
    method: 'post',
    path: '/teams/current/invites',
    response: 'CreateTeamInviteResponse',
    security: true,
    summary: '创建邀请',
  },
  { method: 'get', path: '/team-invites/{token}', response: 'TeamInvitePreviewResponse', summary: '预览邀请' },
  {
    method: 'post',
    path: '/team-invites/{token}/accept',
    request: 'AcceptTeamInviteRequest',
    response: 'TeamResponse',
    security: true,
    summary: '接受邀请',
  },
  {
    method: 'put',
    path: '/share-settings',
    request: 'ShareSettings',
    response: 'ShareSettingsResponse',
    security: true,
    summary: '更新共享设置',
  },
  {
    method: 'put',
    path: '/share-snapshots/today',
    request: 'DailyShareRequest',
    response: 'DailyShareResponse',
    security: true,
    summary: '上传今日共享快照',
  },
  {
    method: 'get',
    path: '/teams/current/snapshots',
    response: 'TeamSnapshotsResponse',
    security: true,
    summary: '小队今日快照',
  },
  {
    method: 'post',
    path: '/nudges',
    request: 'CreateBuddyNudgeRequest',
    response: 'BuddyNudge',
    security: true,
    summary: '发送搭子提醒',
  },
  { method: 'get', path: '/nudges/inbox', response: 'BuddyNudgesResponse', security: true, summary: '提醒收件箱' },
  { method: 'get', path: '/nudges/sent', response: 'BuddyNudgesResponse', security: true, summary: '提醒发件箱' },
  { method: 'get', path: '/nudges/threads', response: 'NudgeThreadsResponse', security: true, summary: '提醒会话摘要' },
  {
    method: 'get',
    path: '/nudges/threads/{buddyUserId}',
    response: 'BuddyNudgeThreadResponse',
    security: true,
    summary: '提醒会话详情',
  },
  {
    method: 'post',
    path: '/nudges/{id}/ack',
    request: 'BuddyNudgeAckRequest',
    response: 'BuddyNudgeAckResponse',
    security: true,
    summary: '回复提醒',
  },
  {
    method: 'get',
    path: '/buddy-nudge-settings',
    response: 'BuddyNudgeSettingsResponse',
    security: true,
    summary: '提醒设置',
  },
  {
    method: 'put',
    path: '/buddy-nudge-settings/{buddyUserId}',
    request: 'BuddyNudgeSettingsRequest',
    response: 'BuddyNudgeSettingsResponse',
    security: true,
    summary: '更新提醒设置',
  },
  {
    method: 'post',
    path: '/push-tokens',
    request: 'PushTokenRequest',
    response: 'PushTokenResponse',
    security: true,
    summary: '注册 Push token',
  },
  {
    method: 'post',
    path: '/subscriptions/verify',
    request: 'VerifySubscriptionRequest',
    response: 'SubscriptionActionResponse',
    security: true,
    summary: '提交订阅校验',
  },
  {
    method: 'post',
    path: '/subscriptions/restore',
    request: 'RestoreSubscriptionRequest',
    response: 'SubscriptionActionResponse',
    security: true,
    summary: '恢复订阅',
  },
  {
    method: 'put',
    path: '/report-snapshots/today',
    request: 'DailyReportRequest',
    response: 'DailyReportResponse',
    security: true,
    summary: '上传个人日报',
  },
  {
    method: 'put',
    path: '/report-snapshots/bulk',
    request: 'DailyReportBulkRequest',
    response: 'DailyReportBulkResponse',
    security: true,
    summary: '批量上传个人日报',
  },
  {
    method: 'get',
    path: '/reports/advanced',
    response: 'AdvancedReportResponse',
    security: true,
    summary: '90 天高级报告',
  },
  {
    method: 'get',
    path: '/teams/current/reports/weekly',
    response: 'TeamWeeklyReportResponse',
    security: true,
    summary: '小队周报',
  },
];

const paths: Record<string, Record<string, unknown>> = {};
for (const operation of operations) {
  paths[operation.path] ??= {};
  paths[operation.path]![operation.method] = {
    ...(operation.request
      ? { requestBody: { content: { 'application/json': { schema: ref(operation.request) } }, required: true } }
      : {}),
    responses: {
      200: {
        content: { 'application/json': { schema: successEnvelope(ref(operation.response)) } },
        description: '成功',
      },
      400: { description: '请求不合法' },
      401: { description: '未登录或会话失效' },
    },
    ...(operation.security ? { security: [{ bearerAuth: [] }] } : {}),
    summary: operation.summary,
  };
}

const document = {
  components: {
    schemas: Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, z.toJSONSchema(schema)])),
    securitySchemes: { bearerAuth: { bearerFormat: 'JWT', scheme: 'bearer', type: 'http' } },
  },
  info: { title: '小提督 API', version: '0.2.0' },
  openapi: '3.1.0',
  paths,
  servers: [{ url: 'http://localhost:8787' }],
};

const openapi = `${JSON.stringify(document, null, 2)}\n`;
const markdown = `# 小提督 API 参考\n\n此文件由 \`pnpm --filter @xiaotidu/api docs:generate\` 生成。请求与响应结构以 \`@xiaotidu/contracts\` 的 Zod schema 为准。\n\n## 认证\n\n登录返回 15 分钟 access token 和 30 天 refresh token。除登录、刷新、健康检查和邀请预览外，接口使用 \`Authorization: Bearer <accessToken>\`。\n\n## 接口\n\n${operations.map((item) => `- \`${item.method.toUpperCase()} ${item.path}\`：${item.summary}`).join('\n')}\n`;
const root = resolve(import.meta.dirname, '../../..');
const outputs = [
  [resolve(root, 'docs/v0.2/openapi.json'), openapi],
  [resolve(root, 'docs/v0.2/api-reference.md'), markdown],
] as const;

if (process.argv.includes('--check')) {
  const stale = outputs.filter(([path, content]) => readFileSync(path, 'utf8') !== content);
  if (stale.length > 0) {
    console.error(`Generated API documentation is stale: ${stale.map(([path]) => path).join(', ')}`);
    process.exitCode = 1;
  }
} else {
  for (const [path, content] of outputs) writeFileSync(path, content);
}

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

function successEnvelope(data: object) {
  return { properties: { data }, required: ['data'], type: 'object' };
}

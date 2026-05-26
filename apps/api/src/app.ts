import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import type { Logger } from 'pino';
import { ZodError } from 'zod';

import type { DatabaseHealthChecker } from './db/health.js';
import { createAuthMiddleware } from './http/middleware/auth.js';
import { createProMiddleware } from './http/middleware/pro.js';
import { ApiError, isApiError } from './http/apiError.js';
import { toErrorResponse } from './http/responses.js';
import { logger as defaultLogger } from './lib/logger.js';
import type { AppleAuthService } from './modules/auth/appleAuthService.js';
import { createMockAppleAuthService } from './modules/auth/appleAuthService.js';
import type { EntitlementsService } from './modules/entitlements/entitlementsService.js';
import { createMockEntitlementsService } from './modules/entitlements/entitlementsService.js';
import type { NudgeService } from './modules/nudges/nudgeService.js';
import { createMockNudgeService } from './modules/nudges/nudgeService.js';
import type { PushTokenService } from './modules/push/pushTokenService.js';
import { createMockPushTokenService } from './modules/push/pushTokenService.js';
import type { ReportService } from './modules/reports/reportService.js';
import { createMockReportService } from './modules/reports/reportService.js';
import type { TeamService } from './modules/teams/teamService.js';
import { createMockTeamService } from './modules/teams/teamService.js';
import type { AvatarStorageService } from './modules/storage/avatarStorageService.js';
import { createMockAvatarStorageService } from './modules/storage/avatarStorageService.js';
import type { UserRepository } from './modules/users/userRepository.js';
import { createMockUserRepository } from './modules/users/userRepository.js';
import { createAuthRoute } from './routes/auth.js';
import { createHealthRoute } from './routes/health.js';
import { createMeRoute } from './routes/me.js';
import { createMockStorageRoute } from './routes/mockStorage.js';
import { createBuddyNudgeSettingsRoute, createNudgesRoute } from './routes/nudges.js';
import { createPushTokensRoute } from './routes/pushTokens.js';
import { createReportsRoute } from './routes/reports.js';
import { createShareSettingsRoute, createShareSnapshotsRoute } from './routes/share.js';
import { createSubscriptionsRoute } from './routes/subscriptions.js';
import { createTeamInvitesRoute } from './routes/teamInvites.js';
import { createTeamsRoute } from './routes/teams.js';

type CreateApiAppOptions = {
  appleAuthService?: AppleAuthService;
  avatarStorageService?: AvatarStorageService;
  databaseHealthChecker?: DatabaseHealthChecker;
  entitlementsService?: EntitlementsService;
  logger?: Logger;
  nudgeService?: NudgeService;
  pushTokenService?: PushTokenService;
  reportService?: ReportService;
  teamService?: TeamService;
  userRepository?: UserRepository;
};

function isJsonParseError(error: unknown) {
  return error instanceof SyntaxError && /JSON|Unexpected end/.test(error.message);
}

export function createApiApp(options: CreateApiAppOptions = {}) {
  const log = options.logger ?? defaultLogger;
  const appleAuthService = options.appleAuthService ?? createMockAppleAuthService();
  const avatarStorageService = options.avatarStorageService ?? createMockAvatarStorageService();
  const entitlementsService = options.entitlementsService ?? createMockEntitlementsService();
  const teamService = options.teamService ?? createMockTeamService();
  const nudgeService = options.nudgeService ?? createMockNudgeService({ teamService });
  const pushTokenService = options.pushTokenService ?? createMockPushTokenService();
  const reportService = options.reportService ?? createMockReportService({ teamService });
  const userRepository = options.userRepository ?? createMockUserRepository();
  const app = new Hono();
  const authMiddleware = createAuthMiddleware(userRepository);
  const proMiddleware = createProMiddleware(entitlementsService);

  app.use('*', requestId());
  app.use('*', async (context, next) => {
    const startedAt = Date.now();

    await next();

    log.info(
      {
        durationMs: Date.now() - startedAt,
        method: context.req.method,
        path: context.req.path,
        requestId: context.get('requestId'),
        status: context.res.status,
      },
      'request completed',
    );
  });

  app.route('/', createHealthRoute({ databaseHealthChecker: options.databaseHealthChecker }));
  app.route('/auth', createAuthRoute({ appleAuthService, authMiddleware, userRepository }));
  app.use('/me/*', authMiddleware);
  app.use('/me', authMiddleware);
  app.route('/me', createMeRoute({ avatarStorageService, entitlementsService, userRepository }));
  app.route('/mock-storage', createMockStorageRoute({ avatarStorageService }));
  app.route('/team-invites', createTeamInvitesRoute({ authMiddleware, teamService }));
  app.use('/teams/*', authMiddleware);
  app.use('/teams', authMiddleware);
  app.route('/teams', createTeamsRoute({ proMiddleware, teamService }));
  app.use('/share-settings/*', authMiddleware);
  app.use('/share-settings', authMiddleware);
  app.route('/share-settings', createShareSettingsRoute({ teamService }));
  app.use('/share-snapshots/*', authMiddleware);
  app.use('/share-snapshots', authMiddleware);
  app.route('/share-snapshots', createShareSnapshotsRoute({ teamService }));
  app.use('/nudges/*', authMiddleware);
  app.use('/nudges', authMiddleware);
  app.route('/nudges', createNudgesRoute({ nudgeService, proMiddleware }));
  app.use('/buddy-nudge-settings/*', authMiddleware);
  app.use('/buddy-nudge-settings', authMiddleware);
  app.route('/buddy-nudge-settings', createBuddyNudgeSettingsRoute({ nudgeService }));
  app.use('/push-tokens/*', authMiddleware);
  app.use('/push-tokens', authMiddleware);
  app.route('/push-tokens', createPushTokensRoute({ pushTokenService }));
  app.use('/subscriptions/*', authMiddleware);
  app.use('/subscriptions', authMiddleware);
  app.route('/subscriptions', createSubscriptionsRoute({ entitlementsService }));
  app.use('/reports/*', authMiddleware);
  app.use('/report-snapshots/*', authMiddleware);
  app.use('/report-snapshots', authMiddleware);
  app.use('/teams/current/reports/*', authMiddleware);
  app.route('/', createReportsRoute({ entitlementsService, reportService }));

  app.notFound((context) => {
    const error = new ApiError(404, 'not_found', '没有找到这个接口。');
    return context.json(toErrorResponse(error.code, error.message), error.statusCode);
  });

  app.onError((error, context) => {
    if (isApiError(error)) {
      return context.json(toErrorResponse(error.code, error.message, error.details), error.statusCode);
    }

    if (error instanceof ZodError) {
      return context.json(toErrorResponse('validation_error', '请求参数不符合预期。', error.issues), 400);
    }

    if (isJsonParseError(error)) {
      return context.json(toErrorResponse('validation_error', '请求体不是有效 JSON。'), 400);
    }

    log.error(
      {
        err: error,
        method: context.req.method,
        path: context.req.path,
        requestId: context.get('requestId'),
      },
      'request failed',
    );

    return context.json(toErrorResponse('internal_server_error', '服务暂时有点忙。'), 500);
  });

  return app;
}

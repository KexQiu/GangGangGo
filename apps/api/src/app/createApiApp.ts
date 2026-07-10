import { Hono } from 'hono';
import { requestId } from 'hono/request-id';

import { createAuthMiddleware } from '../http/middleware/auth.js';
import { createProMiddleware } from '../http/middleware/pro.js';
import { logger as defaultLogger } from '../lib/logger.js';
import { createMockAppleAuthService } from '../modules/auth/appleAuthService.js';
import { createMockEntitlementsService } from '../modules/entitlements/entitlementsService.js';
import { createMockNudgeService } from '../modules/nudges/nudgeService.js';
import { createMockPushTokenService } from '../modules/push/pushTokenService.js';
import { createMockReportService } from '../modules/reports/reportService.js';
import { createMockTeamService } from '../modules/teams/teamService.js';
import { createMockUserRepository } from '../modules/users/userRepository.js';
import { createErrorHandler, notFoundHandler } from './errorHandler.js';
import { registerRoutes } from './registerRoutes.js';
import { createRequestLogger } from './requestLogger.js';
import type { CreateApiAppOptions } from './types.js';

export function createApiApp(options: CreateApiAppOptions = {}) {
  const log = options.logger ?? defaultLogger;
  const appleAuthService = options.appleAuthService ?? createMockAppleAuthService();
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
  app.use('*', createRequestLogger(log));

  registerRoutes(app, {
    appleAuthService,
    authMiddleware,
    databaseHealthChecker: options.databaseHealthChecker,
    entitlementsService,
    nudgeService,
    proMiddleware,
    pushTokenService,
    reportService,
    teamService,
    userRepository,
  });

  app.notFound(notFoundHandler);
  app.onError(createErrorHandler(log));

  return app;
}

export type { CreateApiAppOptions } from './types.js';

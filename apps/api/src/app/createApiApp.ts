import { requestId } from 'hono/request-id';

import { createOpenApiRouter } from '../http/openapi.js';
import { createAuthMiddleware } from '../http/middleware/auth.js';
import { logger as defaultLogger } from '../lib/logger.js';
import { createMockAppleAuthService } from '../modules/auth/appleAuthService.js';
import { createMockAuthSessionService } from '../modules/auth/authSessionService.js';
import { createMockDataSyncService } from '../modules/dataSync/dataSyncService.js';
import { createMockEntitlementsService } from '../modules/entitlements/entitlementsService.js';
import { createMockFriendService } from '../modules/friends/friendService.js';
import { createMockGrowthEventService } from '../modules/growth/growthEventService.js';
import { createMockPushTokenService } from '../modules/push/pushTokenService.js';
import { createMockReportService } from '../modules/reports/reportService.js';
import { createMockUserRepository } from '../modules/users/userRepository.js';
import { createErrorHandler, notFoundHandler } from './errorHandler.js';
import { registerRoutes } from './registerRoutes.js';
import { createRequestLogger } from './requestLogger.js';
import type { CreateApiAppOptions } from './types.js';

export function createApiApp(options: CreateApiAppOptions = {}) {
  const log = options.logger ?? defaultLogger;
  const appleAuthService = options.appleAuthService ?? createMockAppleAuthService();
  const authSessionService = options.authSessionService ?? createMockAuthSessionService();
  const entitlementsService = options.entitlementsService ?? createMockEntitlementsService();
  const friendService = options.friendService ?? createMockFriendService();
  const growthEventService = options.growthEventService ?? createMockGrowthEventService();
  const dataSyncService = options.dataSyncService ?? createMockDataSyncService({ friendService });
  const pushTokenService = options.pushTokenService ?? createMockPushTokenService();
  const reportService = options.reportService ?? createMockReportService();
  const userRepository = options.userRepository ?? createMockUserRepository();
  const app = createOpenApiRouter();
  const authMiddleware = createAuthMiddleware(userRepository, authSessionService);

  app.use('*', requestId());
  app.use('*', createRequestLogger(log));

  registerRoutes(app, {
    appleAuthService,
    authSessionService,
    authMiddleware,
    dataSyncService,
    databaseHealthChecker: options.databaseHealthChecker,
    entitlementsService,
    friendService,
    growthEventService,
    pushTokenService,
    reportService,
    userRepository,
  });

  app.notFound(notFoundHandler);
  app.onError(createErrorHandler(log));

  return app;
}

export type { CreateApiAppOptions } from './types.js';

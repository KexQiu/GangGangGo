import { requestId } from 'hono/request-id';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';

import { env } from '../config/env.js';
import { createOpenApiRouter } from '../http/openapi.js';
import { createAuthMiddleware } from '../http/middleware/auth.js';
import { createRateLimitMiddleware } from '../http/middleware/rateLimit.js';
import { toErrorResponse } from '../http/responses.js';
import { logger as defaultLogger } from '../lib/logger.js';
import { createMockAppleAuthService } from '../modules/auth/appleAuthService.js';
import { createMockAuthSessionService } from '../modules/auth/authSessionService.js';
import { createMockDataSyncService } from '../modules/dataSync/dataSyncService.js';
import { createMockEntitlementsService } from '../modules/entitlements/entitlementsService.js';
import { createMockFriendService } from '../modules/friends/friendService.js';
import { createMockGrowthEventService } from '../modules/growth/growthEventService.js';
import { createMockPushTokenService } from '../modules/push/pushTokenService.js';
import { createMockReportService } from '../modules/reports/reportService.js';
import { createMockAccountDataService } from '../modules/users/accountDataService.js';
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
  const accountDataService = options.accountDataService ?? createMockAccountDataService(userRepository);
  const app = createOpenApiRouter();
  const authMiddleware = createAuthMiddleware(userRepository, authSessionService);

  app.use('*', requestId());
  app.use('*', createRequestLogger(log));
  app.use('*', secureHeaders());
  app.use(
    '*',
    createRateLimitMiddleware({
      maxRequests: env.API_RATE_LIMIT_MAX,
      windowMs: env.API_RATE_LIMIT_WINDOW_SECONDS * 1000,
    }),
  );
  app.use(
    '*',
    bodyLimit({
      maxSize: env.REQUEST_BODY_LIMIT_BYTES,
      onError: (context) => context.json(toErrorResponse('payload_too_large', '请求体超过服务器允许的大小。'), 413),
    }),
  );

  registerRoutes(app, {
    accountDataService,
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

import type { MiddlewareHandler } from 'hono';
import type { Logger } from 'pino';

import type { DatabaseHealthChecker } from '../db/health.js';
import type { AuthVariables } from '../http/middleware/auth.js';
import type { AppleAuthService } from '../modules/auth/appleAuthService.js';
import type { AuthSessionService } from '../modules/auth/authSessionService.js';
import type { DataSyncService } from '../modules/dataSync/dataSyncService.js';
import type { EntitlementsService } from '../modules/entitlements/entitlementsService.js';
import type { NudgeService } from '../modules/nudges/nudgeService.js';
import type { PushTokenService } from '../modules/push/pushTokenService.js';
import type { ReportService } from '../modules/reports/reportService.js';
import type { TeamService } from '../modules/teams/teamService.js';
import type { UserRepository } from '../modules/users/userRepository.js';

export type ApiMiddleware = MiddlewareHandler<{ Variables: AuthVariables }>;

export type ApiRouteDependencies = {
  appleAuthService: AppleAuthService;
  authSessionService: AuthSessionService;
  authMiddleware: ApiMiddleware;
  dataSyncService: DataSyncService;
  databaseHealthChecker?: DatabaseHealthChecker;
  entitlementsService: EntitlementsService;
  nudgeService: NudgeService;
  proMiddleware: ApiMiddleware;
  pushTokenService: PushTokenService;
  reportService: ReportService;
  teamService: TeamService;
  userRepository: UserRepository;
};

export type CreateApiAppOptions = {
  appleAuthService?: AppleAuthService;
  authSessionService?: AuthSessionService;
  dataSyncService?: DataSyncService;
  databaseHealthChecker?: DatabaseHealthChecker;
  entitlementsService?: EntitlementsService;
  logger?: Logger;
  nudgeService?: NudgeService;
  pushTokenService?: PushTokenService;
  reportService?: ReportService;
  teamService?: TeamService;
  userRepository?: UserRepository;
};

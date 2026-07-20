import { env } from '../config/env.js';
import { createDatabaseClient, isDatabaseConfigured, type DatabaseClient } from '../db/client.js';
import { createAppleJwtAuthService, createMockAppleAuthService } from '../modules/auth/appleAuthService.js';
import {
  createDrizzleAuthSessionService,
  createMockAuthSessionService,
  type AuthSessionService,
} from '../modules/auth/authSessionService.js';
import {
  createDrizzleEntitlementsService,
  createMockEntitlementsService,
  type EntitlementsService,
} from '../modules/entitlements/entitlementsService.js';
import {
  createDrizzleNudgeService,
  createMockNudgeService,
  type NudgeService,
} from '../modules/nudges/nudgeService.js';
import {
  createExpoPushNotificationService,
  createNoopPushNotificationService,
  type PushNotificationService,
} from '../modules/push/pushNotificationService.js';
import {
  createDrizzlePushTokenService,
  createMockPushTokenService,
  type PushTokenService,
} from '../modules/push/pushTokenService.js';
import {
  createDrizzleReportService,
  createMockReportService,
  type ReportService,
} from '../modules/reports/reportService.js';
import { createDrizzleTeamService, createMockTeamService, type TeamService } from '../modules/teams/teamService.js';
import {
  createDrizzleUserRepository,
  createMockUserRepository,
  type UserRepository,
} from '../modules/users/userRepository.js';

export type ApiDependencies = {
  close: () => Promise<void>;
  authSessionService: AuthSessionService;
  databaseClient?: DatabaseClient;
  entitlementsService: EntitlementsService;
  nudgeService: NudgeService;
  pushNotificationService: PushNotificationService;
  pushTokenService: PushTokenService;
  reportService: ReportService;
  teamService: TeamService;
  userRepository: UserRepository;
};

export function createApiDependencies(): ApiDependencies {
  if (!isDatabaseConfigured()) {
    const teamService = createMockTeamService();

    return {
      authSessionService: createMockAuthSessionService(),
      close: async () => {},
      entitlementsService: createMockEntitlementsService(),
      nudgeService: createMockNudgeService({
        pushNotificationService: createNoopPushNotificationService(),
        teamService,
      }),
      pushNotificationService: createNoopPushNotificationService(),
      pushTokenService: createMockPushTokenService(),
      reportService: createMockReportService({ teamService }),
      teamService,
      userRepository: createMockUserRepository(),
    };
  }

  const databaseClient = createDatabaseClient();
  const pushNotificationService = createExpoPushNotificationService(databaseClient.db, {
    accessToken: env.EXPO_PUSH_ACCESS_TOKEN,
  });

  return {
    authSessionService: createDrizzleAuthSessionService(databaseClient.db),
    close: async () => {
      await databaseClient.close();
    },
    databaseClient,
    entitlementsService: createDrizzleEntitlementsService(databaseClient.db),
    nudgeService: createDrizzleNudgeService(databaseClient.db, { pushNotificationService }),
    pushNotificationService,
    pushTokenService: createDrizzlePushTokenService(databaseClient.db),
    reportService: createDrizzleReportService(databaseClient.db),
    teamService: createDrizzleTeamService(databaseClient.db),
    userRepository: createDrizzleUserRepository(databaseClient.db),
  };
}

export function createDefaultAppleAuthService() {
  if (env.APPLE_AUTH_MODE === 'real') {
    return createAppleJwtAuthService();
  }

  return createMockAppleAuthService();
}

export function createDefaultEntitlementsService() {
  return createMockEntitlementsService();
}

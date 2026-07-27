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
  createDrizzleDataSyncService,
  createMockDataSyncService,
  type DataSyncService,
} from '../modules/dataSync/dataSyncService.js';
import {
  createDrizzleFriendService,
  createMockFriendService,
  type FriendService,
} from '../modules/friends/friendService.js';
import {
  createDrizzleGrowthEventService,
  createMockGrowthEventService,
  type GrowthEventService,
} from '../modules/growth/growthEventService.js';
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
import {
  createDrizzleUserRepository,
  createMockUserRepository,
  type UserRepository,
} from '../modules/users/userRepository.js';

export type ApiDependencies = {
  close: () => Promise<void>;
  authSessionService: AuthSessionService;
  dataSyncService: DataSyncService;
  databaseClient?: DatabaseClient;
  entitlementsService: EntitlementsService;
  friendService: FriendService;
  growthEventService: GrowthEventService;
  pushNotificationService: PushNotificationService;
  pushTokenService: PushTokenService;
  reportService: ReportService;
  userRepository: UserRepository;
};

export function createApiDependencies(): ApiDependencies {
  if (!isDatabaseConfigured()) {
    const pushNotificationService = createNoopPushNotificationService();
    const friendService = createMockFriendService({ pushNotificationService });

    return {
      authSessionService: createMockAuthSessionService(),
      close: async () => {},
      dataSyncService: createMockDataSyncService({ friendService }),
      entitlementsService: createMockEntitlementsService({ commercialMode: env.COMMERCIAL_MODE }),
      friendService,
      growthEventService: createMockGrowthEventService(),
      pushNotificationService,
      pushTokenService: createMockPushTokenService(),
      reportService: createMockReportService(),
      userRepository: createMockUserRepository(),
    };
  }

  const databaseClient = createDatabaseClient();
  const pushNotificationService = createExpoPushNotificationService(databaseClient.db, {
    accessToken: env.EXPO_PUSH_ACCESS_TOKEN,
  });
  const friendService = createDrizzleFriendService(databaseClient.db, { pushNotificationService });

  return {
    authSessionService: createDrizzleAuthSessionService(databaseClient.db),
    close: async () => {
      await databaseClient.close();
    },
    dataSyncService: createDrizzleDataSyncService(databaseClient.db, { friendService }),
    databaseClient,
    entitlementsService: createDrizzleEntitlementsService(databaseClient.db, {
      commercialMode: env.COMMERCIAL_MODE,
    }),
    friendService,
    growthEventService: createDrizzleGrowthEventService(databaseClient.db),
    pushNotificationService,
    pushTokenService: createDrizzlePushTokenService(databaseClient.db),
    reportService: createDrizzleReportService(databaseClient.db),
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
  return createMockEntitlementsService({ commercialMode: env.COMMERCIAL_MODE });
}

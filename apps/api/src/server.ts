import { serve } from '@hono/node-server';

import { env } from './config/env.js';
import { createApiApp } from './app.js';
import { createApiDependencies, createDefaultAppleAuthService } from './dependencies.js';
import { logger } from './lib/logger.js';
import { createDrizzleRateLimitStore } from './http/middleware/rateLimitStore.js';

const dependencies = createApiDependencies();
const app = createApiApp({
  rateLimitStore: dependencies.databaseClient ? createDrizzleRateLimitStore(dependencies.databaseClient.db) : undefined,
  accountDataService: dependencies.accountDataService,
  appleAuthService: createDefaultAppleAuthService(),
  authSessionService: dependencies.authSessionService,
  dataSyncService: dependencies.dataSyncService,
  entitlementsService: dependencies.entitlementsService,
  friendService: dependencies.friendService,
  growthEventService: dependencies.growthEventService,
  pushTokenService: dependencies.pushTokenService,
  userRepository: dependencies.userRepository,
});

serve({
  fetch: app.fetch,
  hostname: env.HOST,
  port: env.PORT,
});

logger.info(
  {
    host: env.HOST,
    port: env.PORT,
  },
  `xiaotidu api listening on http://${env.HOST}:${env.PORT}`,
);

async function shutdown() {
  await dependencies.close();
  process.exit(0);
}

process.once('SIGINT', () => {
  void shutdown();
});
process.once('SIGTERM', () => {
  void shutdown();
});

import { serve } from '@hono/node-server';

import { env } from './config/env.js';
import { createApiApp } from './app.js';
import { createApiDependencies, createDefaultAppleAuthService } from './dependencies.js';
import { logger } from './lib/logger.js';

const dependencies = createApiDependencies();
const app = createApiApp({
  accountDataService: dependencies.accountDataService,
  appleAuthService: createDefaultAppleAuthService(),
  authSessionService: dependencies.authSessionService,
  dataSyncService: dependencies.dataSyncService,
  entitlementsService: dependencies.entitlementsService,
  friendService: dependencies.friendService,
  growthEventService: dependencies.growthEventService,
  pushTokenService: dependencies.pushTokenService,
  reportService: dependencies.reportService,
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

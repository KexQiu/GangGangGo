import { serve } from '@hono/node-server';

import { env } from './config/env.js';
import { createApiApp } from './app.js';
import { createApiDependencies, createDefaultAppleAuthService } from './dependencies.js';
import { logger } from './lib/logger.js';

const dependencies = createApiDependencies();
const app = createApiApp({
  appleAuthService: createDefaultAppleAuthService(),
  entitlementsService: dependencies.entitlementsService,
  nudgeService: dependencies.nudgeService,
  pushTokenService: dependencies.pushTokenService,
  reportService: dependencies.reportService,
  teamService: dependencies.teamService,
  userRepository: dependencies.userRepository,
});

serve({
  fetch: app.fetch,
  port: env.PORT,
});

logger.info({
  port: env.PORT,
}, `xiaotidu api listening on http://localhost:${env.PORT}`);

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

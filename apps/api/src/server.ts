import { serve } from '@hono/node-server';

import { env } from './config/env.js';
import { createApiApp } from './app.js';
import { logger } from './lib/logger.js';

const app = createApiApp();

serve({
  fetch: app.fetch,
  port: env.PORT,
});

logger.info({
  port: env.PORT,
}, `xiaotidu api listening on http://localhost:${env.PORT}`);

import type { OpenAPIHono } from '@hono/zod-openapi';

import { createAuthRoute } from '../modules/auth/auth.route.js';
import { createDataSyncRoute } from '../modules/dataSync/dataSync.route.js';
import { createHealthRoute } from '../modules/health/health.route.js';
import {
  createFriendEventsRoute,
  createFriendInvitesRoute,
  createFriendsRoute,
} from '../modules/friends/friends.route.js';
import { createGrowthEventsRoute } from '../modules/growth/growthEvents.route.js';
import { createPushTokensRoute } from '../modules/push/pushTokens.route.js';
import { createReportsRoute } from '../modules/reports/reports.route.js';
import { createSubscriptionsRoute } from '../modules/subscriptions/subscriptions.route.js';
import { createMeRoute } from '../modules/users/me.route.js';
import type { ApiRouteDependencies } from './types.js';

export function registerRoutes(app: OpenAPIHono, dependencies: ApiRouteDependencies) {
  app.route('/', createHealthRoute({ databaseHealthChecker: dependencies.databaseHealthChecker }));
  app.route(
    '/auth',
    createAuthRoute({
      appleAuthService: dependencies.appleAuthService,
      authSessionService: dependencies.authSessionService,
      authMiddleware: dependencies.authMiddleware,
      userRepository: dependencies.userRepository,
    }),
  );
  app.use('/data-sync/*', dependencies.authMiddleware);
  app.use('/data-sync', dependencies.authMiddleware);
  app.route('/data-sync', createDataSyncRoute({ dataSyncService: dependencies.dataSyncService }));
  app.use('/me/*', dependencies.authMiddleware);
  app.use('/me', dependencies.authMiddleware);
  app.route(
    '/me',
    createMeRoute({
      entitlementsService: dependencies.entitlementsService,
      userRepository: dependencies.userRepository,
    }),
  );
  app.route(
    '/me/growth-events',
    createGrowthEventsRoute({
      growthEventService: dependencies.growthEventService,
      requiresAuth: true,
    }),
  );
  app.route('/growth-events', createGrowthEventsRoute({ growthEventService: dependencies.growthEventService }));
  app.route(
    '/friend-invites',
    createFriendInvitesRoute({
      authMiddleware: dependencies.authMiddleware,
      friendService: dependencies.friendService,
    }),
  );
  app.use('/friends/*', dependencies.authMiddleware);
  app.use('/friends', dependencies.authMiddleware);
  app.route('/friends', createFriendsRoute({ friendService: dependencies.friendService }));
  app.use('/friend-events/*', dependencies.authMiddleware);
  app.route('/friend-events', createFriendEventsRoute({ friendService: dependencies.friendService }));
  app.use('/push-tokens/*', dependencies.authMiddleware);
  app.use('/push-tokens', dependencies.authMiddleware);
  app.route('/push-tokens', createPushTokensRoute({ pushTokenService: dependencies.pushTokenService }));
  app.use('/subscriptions/*', dependencies.authMiddleware);
  app.use('/subscriptions', dependencies.authMiddleware);
  app.route('/subscriptions', createSubscriptionsRoute({ entitlementsService: dependencies.entitlementsService }));
  app.use('/reports/*', dependencies.authMiddleware);
  app.use('/report-snapshots/*', dependencies.authMiddleware);
  app.use('/report-snapshots', dependencies.authMiddleware);
  app.route(
    '/',
    createReportsRoute({
      entitlementsService: dependencies.entitlementsService,
      reportService: dependencies.reportService,
    }),
  );
}

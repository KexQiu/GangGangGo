import type { OpenAPIHono } from '@hono/zod-openapi';

import { createAuthRoute } from '../modules/auth/auth.route.js';
import { createDataSyncRoute } from '../modules/dataSync/dataSync.route.js';
import { createHealthRoute } from '../modules/health/health.route.js';
import { createBuddyNudgeSettingsRoute, createNudgesRoute } from '../modules/nudges/nudges.route.js';
import { createPushTokensRoute } from '../modules/push/pushTokens.route.js';
import { createReportsRoute } from '../modules/reports/reports.route.js';
import { createSubscriptionsRoute } from '../modules/subscriptions/subscriptions.route.js';
import { createShareSettingsRoute, createShareSnapshotsRoute } from '../modules/teams/share.route.js';
import { createTeamInvitesRoute } from '../modules/teams/teamInvites.route.js';
import { createTeamsRoute } from '../modules/teams/teams.route.js';
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
    '/team-invites',
    createTeamInvitesRoute({
      authMiddleware: dependencies.authMiddleware,
      teamService: dependencies.teamService,
    }),
  );
  app.use('/teams/*', dependencies.authMiddleware);
  app.use('/teams', dependencies.authMiddleware);
  app.route(
    '/teams',
    createTeamsRoute({
      proMiddleware: dependencies.proMiddleware,
      teamService: dependencies.teamService,
    }),
  );
  app.use('/share-settings/*', dependencies.authMiddleware);
  app.use('/share-settings', dependencies.authMiddleware);
  app.route('/share-settings', createShareSettingsRoute({ teamService: dependencies.teamService }));
  app.use('/share-snapshots/*', dependencies.authMiddleware);
  app.use('/share-snapshots', dependencies.authMiddleware);
  app.route('/share-snapshots', createShareSnapshotsRoute({ teamService: dependencies.teamService }));
  app.use('/nudges/*', dependencies.authMiddleware);
  app.use('/nudges', dependencies.authMiddleware);
  app.route(
    '/nudges',
    createNudgesRoute({
      nudgeService: dependencies.nudgeService,
      proMiddleware: dependencies.proMiddleware,
    }),
  );
  app.use('/buddy-nudge-settings/*', dependencies.authMiddleware);
  app.use('/buddy-nudge-settings', dependencies.authMiddleware);
  app.route('/buddy-nudge-settings', createBuddyNudgeSettingsRoute({ nudgeService: dependencies.nudgeService }));
  app.use('/push-tokens/*', dependencies.authMiddleware);
  app.use('/push-tokens', dependencies.authMiddleware);
  app.route('/push-tokens', createPushTokensRoute({ pushTokenService: dependencies.pushTokenService }));
  app.use('/subscriptions/*', dependencies.authMiddleware);
  app.use('/subscriptions', dependencies.authMiddleware);
  app.route('/subscriptions', createSubscriptionsRoute({ entitlementsService: dependencies.entitlementsService }));
  app.use('/reports/*', dependencies.authMiddleware);
  app.use('/report-snapshots/*', dependencies.authMiddleware);
  app.use('/report-snapshots', dependencies.authMiddleware);
  app.use('/teams/current/reports/*', dependencies.authMiddleware);
  app.route(
    '/',
    createReportsRoute({
      entitlementsService: dependencies.entitlementsService,
      reportService: dependencies.reportService,
    }),
  );
}

import { describe, expect, it } from 'vitest';

import {
  apiErrorCodeSchema,
  apiErrorResponseSchema,
  apiHealthResponseSchema,
  appleLoginRequestSchema,
  authResponseSchema,
  authSessionSchema,
  commercialModeSchema,
  databaseHealthResponseSchema,
  entitlementsResponseSchema,
  featureAccessSchema,
  growthEventSchema,
  growthEventsRequestSchema,
  isoDateSchema,
  isoDateTimeSchema,
  logoutRequestSchema,
  proStatusSchema,
  quietRangeSchema,
  refreshSessionRequestSchema,
} from '../index.js';
import { NOW, userProfile } from './fixtures.js';

const authSession = {
  accessToken: 'access-token',
  accessTokenExpiresAt: NOW,
  refreshToken: 'refresh-token',
};

describe('common contracts', () => {
  it.each([
    ['isoDateSchema', isoDateSchema, '2024-02-29'],
    ['isoDateTimeSchema', isoDateTimeSchema, NOW],
    ['proStatusSchema', proStatusSchema, 'pro_active'],
    ['commercialModeSchema', commercialModeSchema, 'growth_free'],
    [
      'featureAccessSchema',
      featureAccessSchema,
      { advancedReport: true, reportSnapshotSync: true, watchActions: true },
    ],
    ['apiErrorCodeSchema', apiErrorCodeSchema, 'validation_error'],
    [
      'apiErrorResponseSchema',
      apiErrorResponseSchema,
      { error: { code: 'bad_request', details: { field: 'name' }, message: 'invalid request' } },
    ],
    ['quietRangeSchema', quietRangeSchema, { end: '07:30', start: '23:00' }],
    ['entitlementsResponseSchema', entitlementsResponseSchema, { proStatus: 'free' }],
    ['apiHealthResponseSchema', apiHealthResponseSchema, { ok: true, service: 'xiaotidu-api', version: '0.2.0' }],
    ['databaseHealthResponseSchema', databaseHealthResponseSchema, { database: 'reachable', ok: true }],
  ])('%s accepts a legal value', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it('validates calendar dates and timestamps at their boundaries', () => {
    expect(isoDateSchema.safeParse('2024-02-29').success).toBe(true);
    expect(isoDateSchema.safeParse('2023-02-29').success).toBe(false);
    expect(isoDateSchema.safeParse('2026-7-13').success).toBe(false);
    expect(isoDateTimeSchema.safeParse('2026-07-13T16:30:00+08:00').success).toBe(true);
    expect(isoDateTimeSchema.safeParse('2026-07-13 16:30:00').success).toBe(false);
  });

  it('rejects invalid enums, types, and malformed quiet ranges', () => {
    expect(proStatusSchema.safeParse('premium').success).toBe(false);
    expect(commercialModeSchema.safeParse('free_trial').success).toBe(false);
    expect(featureAccessSchema.safeParse({ advancedReport: true, watchActions: true }).success).toBe(false);
    expect(apiErrorCodeSchema.safeParse(401).success).toBe(false);
    expect(quietRangeSchema.safeParse({ end: '24:00', start: '23:00' }).success).toBe(false);
    expect(quietRangeSchema.safeParse({ end: '00:00', start: '00:00' }).success).toBe(true);
    expect(quietRangeSchema.safeParse({ end: '07:00', extra: true, start: '23:00' }).success).toBe(false);
  });

  it('accepts allowlisted growth events and rejects unexpected properties', () => {
    expect(
      growthEventSchema.safeParse({
        appVersion: '0.2.0',
        eventId: 'event-1234567890123456',
        installationId: 'install-123456789012',
        name: 'watch_action_completed',
        occurredAt: NOW,
        platform: 'ios',
        properties: { action: 'training' },
      }).success,
    ).toBe(true);
    expect(
      growthEventsRequestSchema.safeParse({
        events: [
          {
            appVersion: '0.2.0',
            eventId: 'event-1234567890123456',
            installationId: 'install-123456789012',
            name: 'app_opened',
            occurredAt: NOW,
            platform: 'ios',
            properties: { healthDetail: 'forbidden' },
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('auth contracts', () => {
  it.each([
    ['appleLoginRequestSchema', appleLoginRequestSchema, { identityToken: 'identity-token' }],
    ['authSessionSchema', authSessionSchema, authSession],
    ['authResponseSchema', authResponseSchema, { session: authSession, user: userProfile }],
    ['refreshSessionRequestSchema', refreshSessionRequestSchema, { refreshToken: 'refresh-token' }],
    ['logoutRequestSchema', logoutRequestSchema, {}],
  ])('%s accepts a legal value', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it('accepts optional Apple and logout fields', () => {
    expect(
      appleLoginRequestSchema.safeParse({
        authorizationCode: 'authorization-code',
        identityToken: 'identity-token',
        nickname: '测试用户',
      }).success,
    ).toBe(true);
    expect(logoutRequestSchema.safeParse({ refreshToken: 'refresh-token' }).success).toBe(true);
  });

  it('rejects empty tokens, wrong types, and unknown request fields', () => {
    expect(appleLoginRequestSchema.safeParse({ identityToken: '' }).success).toBe(false);
    expect(authSessionSchema.safeParse({ ...authSession, accessTokenExpiresAt: 'tomorrow' }).success).toBe(false);
    expect(refreshSessionRequestSchema.safeParse({ refreshToken: 1 }).success).toBe(false);
    expect(refreshSessionRequestSchema.safeParse({ refreshToken: 'token', userId: 'unexpected' }).success).toBe(false);
    expect(logoutRequestSchema.safeParse({ allSessions: true }).success).toBe(false);
  });
});

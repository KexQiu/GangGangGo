import { describe, expect, it } from 'vitest';

import {
  autoRenewStatusSchema,
  registerPushTokenRequestSchema,
  registerPushTokenResponseSchema,
  restoreSubscriptionRequestSchema,
  subscriptionActionResponseSchema,
  subscriptionEnvironmentSchema,
  subscriptionProductIdSchema,
  subscriptionStatusSchema,
  verifySubscriptionRequestSchema,
} from '../index.js';
import { PUSH_TOKEN_ID } from './fixtures.js';

describe('push contracts', () => {
  it.each([
    [
      'registerPushTokenRequestSchema',
      registerPushTokenRequestSchema,
      { deviceId: 'iphone-15', platform: 'ios', provider: 'apns', token: 'push-token' },
    ],
    ['registerPushTokenResponseSchema', registerPushTokenResponseSchema, { id: PUSH_TOKEN_ID }],
  ])('%s accepts a legal value', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it('accepts optional device IDs and token length boundaries', () => {
    expect(registerPushTokenRequestSchema.safeParse({ platform: 'ios', provider: 'expo', token: 't' }).success).toBe(
      true,
    );
    expect(
      registerPushTokenRequestSchema.safeParse({
        deviceId: 'd'.repeat(120),
        platform: 'android',
        provider: 'expo',
        token: 't'.repeat(300),
      }).success,
    ).toBe(true);
  });

  it('rejects invalid lengths, enums, types, unknown fields, and provider conflicts', () => {
    expect(registerPushTokenRequestSchema.safeParse({ platform: 'ios', provider: 'expo', token: '' }).success).toBe(
      false,
    );
    expect(
      registerPushTokenRequestSchema.safeParse({ platform: 'ios', provider: 'expo', token: 't'.repeat(301) }).success,
    ).toBe(false);
    expect(
      registerPushTokenRequestSchema.safeParse({ platform: 'web', provider: 'expo', token: 'token' }).success,
    ).toBe(false);
    expect(
      registerPushTokenRequestSchema.safeParse({ platform: 'android', provider: 'apns', token: 'token' }).success,
    ).toBe(false);
    expect(
      registerPushTokenRequestSchema.safeParse({ platform: 'ios', provider: 'expo', token: 'token', topic: 'app' })
        .success,
    ).toBe(false);
  });
});

describe('subscription contracts', () => {
  it.each([
    ['subscriptionStatusSchema', subscriptionStatusSchema, 'active'],
    ['subscriptionEnvironmentSchema', subscriptionEnvironmentSchema, 'sandbox'],
    ['autoRenewStatusSchema', autoRenewStatusSchema, 'unknown'],
    ['subscriptionProductIdSchema', subscriptionProductIdSchema, 'xiaotidu.pro.monthly'],
    [
      'verifySubscriptionRequestSchema',
      verifySubscriptionRequestSchema,
      { productId: 'xiaotidu.pro.yearly', transactionId: 'transaction-id' },
    ],
    ['restoreSubscriptionRequestSchema', restoreSubscriptionRequestSchema, { transactionIds: ['transaction-id'] }],
    [
      'subscriptionActionResponseSchema',
      subscriptionActionResponseSchema,
      { entitlements: { proStatus: 'pro_active' }, status: 'pending_verification' },
    ],
  ])('%s accepts a legal value', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it('accepts transaction length and restore count boundaries', () => {
    expect(
      verifySubscriptionRequestSchema.safeParse({
        productId: 'xiaotidu.pro.monthly',
        transactionId: 't'.repeat(200),
      }).success,
    ).toBe(true);
    expect(
      restoreSubscriptionRequestSchema.safeParse({ transactionIds: Array(20).fill('transaction-id') }).success,
    ).toBe(true);
  });

  it('rejects invalid enums, lengths, types, and unknown fields', () => {
    expect(subscriptionStatusSchema.safeParse('pending').success).toBe(false);
    expect(subscriptionEnvironmentSchema.safeParse('development').success).toBe(false);
    expect(autoRenewStatusSchema.safeParse(true).success).toBe(false);
    expect(subscriptionProductIdSchema.safeParse('xiaotidu.pro.weekly').success).toBe(false);
    expect(
      verifySubscriptionRequestSchema.safeParse({
        productId: 'xiaotidu.pro.monthly',
        transactionId: 't'.repeat(201),
      }).success,
    ).toBe(false);
    expect(restoreSubscriptionRequestSchema.safeParse({ transactionIds: [] }).success).toBe(false);
    expect(
      restoreSubscriptionRequestSchema.safeParse({ transactionIds: Array(21).fill('transaction-id') }).success,
    ).toBe(false);
    expect(
      verifySubscriptionRequestSchema.safeParse({
        environment: 'sandbox',
        productId: 'xiaotidu.pro.monthly',
        transactionId: 'transaction-id',
      }).success,
    ).toBe(false);
  });
});

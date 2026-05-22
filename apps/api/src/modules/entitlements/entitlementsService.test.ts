import { describe, expect, it } from 'vitest';

import { resolveProStatus } from './entitlementsService.js';

describe('resolveProStatus', () => {
  const now = new Date('2026-05-22T00:00:00.000Z');

  it('returns free without a subscription', () => {
    expect(resolveProStatus(null, now)).toBe('free');
  });

  it('returns pro_active for active non-expired subscriptions', () => {
    expect(
      resolveProStatus(
        {
          expiresAt: new Date('2026-05-23T00:00:00.000Z'),
          status: 'active',
        },
        now,
      ),
    ).toBe('pro_active');
  });

  it('returns pro_grace_period for grace period subscriptions', () => {
    expect(
      resolveProStatus(
        {
          expiresAt: new Date('2026-05-23T00:00:00.000Z'),
          status: 'grace_period',
        },
        now,
      ),
    ).toBe('pro_grace_period');
  });

  it('returns pro_expired for expired or revoked subscriptions', () => {
    expect(
      resolveProStatus(
        {
          expiresAt: new Date('2026-05-21T00:00:00.000Z'),
          status: 'active',
        },
        now,
      ),
    ).toBe('pro_expired');
    expect(
      resolveProStatus(
        {
          expiresAt: new Date('2026-05-23T00:00:00.000Z'),
          status: 'revoked',
        },
        now,
      ),
    ).toBe('pro_expired');
  });
});

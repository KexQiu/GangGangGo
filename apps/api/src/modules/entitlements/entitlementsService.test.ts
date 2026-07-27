import { describe, expect, it } from 'vitest';

import { resolveFeatureAccess, resolveProStatus } from './entitlementsService.js';

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

describe('resolveFeatureAccess', () => {
  it('opens current features during growth mode', () => {
    expect(resolveFeatureAccess('growth_free', 'free')).toEqual({
      advancedReport: true,
      reportSnapshotSync: true,
      watchActions: true,
    });
    expect(resolveFeatureAccess('growth_free', 'pro_expired').watchActions).toBe(true);
  });

  it('requires an active entitlement in paid mode', () => {
    expect(resolveFeatureAccess('paid', 'free').advancedReport).toBe(false);
    expect(resolveFeatureAccess('paid', 'pro_expired').reportSnapshotSync).toBe(false);
    expect(resolveFeatureAccess('paid', 'pro_active').watchActions).toBe(true);
    expect(resolveFeatureAccess('paid', 'pro_grace_period').advancedReport).toBe(true);
  });
});

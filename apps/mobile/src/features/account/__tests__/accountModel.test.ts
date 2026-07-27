import { describe, expect, it } from 'vitest';

import { canAccessFeature, defaultEntitlements, isProStatus, migrateAuthPreferences } from '../accountModel';

describe('account model', () => {
  it('treats only active and grace-period entitlements as Pro', () => {
    expect(isProStatus('pro_active')).toBe(true);
    expect(isProStatus('pro_grace_period')).toBe(true);
    expect(isProStatus('pro_expired')).toBe(false);
    expect(isProStatus('free')).toBe(false);
  });

  it('uses feature access independently from subscription status', () => {
    expect(canAccessFeature(defaultEntitlements, 'advancedReport')).toBe(true);
    expect(canAccessFeature(undefined, 'advancedReport')).toBe(false);
    expect(
      canAccessFeature(
        {
          commercialMode: 'paid',
          features: { advancedReport: false, reportSnapshotSync: false, watchActions: false },
          proStatus: 'free',
        },
        'watchActions',
      ),
    ).toBe(false);
  });

  it('drops legacy cloud-state fields from persisted auth preferences', () => {
    expect(
      migrateAuthPreferences({
        proStatus: 'pro_active',
        selectedMockUserId: 'mock-user-b',
        user: { id: 'legacy-user' },
      }),
    ).toEqual({ selectedMockUserId: 'mock-user-b' });
    expect(migrateAuthPreferences({ selectedMockUserId: 'unknown-user' })).toEqual({
      selectedMockUserId: 'mock-user-a',
    });
  });
});

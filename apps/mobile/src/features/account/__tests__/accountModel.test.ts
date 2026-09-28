import { describe, expect, it } from 'vitest';

import { canAccessFeature, defaultEntitlements } from '../accountModel';

describe('account model', () => {
  it('uses feature access independently from subscription status', () => {
    expect(canAccessFeature(defaultEntitlements, 'watchActions')).toBe(true);
    expect(canAccessFeature(undefined, 'watchActions')).toBe(false);
    expect(
      canAccessFeature(
        {
          commercialMode: 'paid',
          features: { watchActions: false },
          proStatus: 'free',
        },
        'watchActions',
      ),
    ).toBe(false);
  });
});

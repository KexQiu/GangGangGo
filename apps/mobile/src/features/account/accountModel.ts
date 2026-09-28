import type { EntitlementsResponse, FeatureAccess, ProStatus } from '@xiaotidu/contracts';

export const defaultProStatus: ProStatus = 'free';
export const defaultFeatureAccess: FeatureAccess = {
  watchActions: true,
};
export const defaultEntitlements: EntitlementsResponse = {
  commercialMode: 'growth_free',
  features: defaultFeatureAccess,
  proStatus: defaultProStatus,
};
export const mockUserIds = ['mock-user-a', 'mock-user-b', 'mock-user-c'] as const;
export type MockUserId = (typeof mockUserIds)[number];

export type FeatureAccessKey = keyof FeatureAccess;

export function canAccessFeature(
  entitlements: EntitlementsResponse | null | undefined,
  feature: FeatureAccessKey,
): boolean {
  return entitlements?.features[feature] ?? false;
}

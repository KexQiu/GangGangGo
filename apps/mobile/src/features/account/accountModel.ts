import type { EntitlementsResponse, FeatureAccess, ProStatus } from '@xiaotidu/contracts';

export const defaultProStatus: ProStatus = 'free';
export const defaultFeatureAccess: FeatureAccess = {
  advancedReport: true,
  reportSnapshotSync: true,
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

export function isProStatus(proStatus: ProStatus): boolean {
  return proStatus === 'pro_active' || proStatus === 'pro_grace_period';
}

export function migrateAuthPreferences(persistedState: unknown): { selectedMockUserId: MockUserId } {
  const selectedMockUserId = (persistedState as { selectedMockUserId?: unknown } | undefined)?.selectedMockUserId;
  return {
    selectedMockUserId: mockUserIds.includes(selectedMockUserId as MockUserId)
      ? (selectedMockUserId as MockUserId)
      : 'mock-user-a',
  };
}

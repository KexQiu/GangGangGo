import type { ProStatus } from '@xiaotidu/contracts';

export const defaultProStatus: ProStatus = 'free';
export const mockUserIds = ['mock-user-a', 'mock-user-b', 'mock-user-c'] as const;
export type MockUserId = (typeof mockUserIds)[number];

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

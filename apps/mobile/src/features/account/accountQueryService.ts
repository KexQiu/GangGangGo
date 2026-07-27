import type { AuthResponse, EntitlementsResponse, UserProfile } from '@xiaotidu/contracts';

import { queryClient } from '../../api/queryClient';
import { accountQueryKeys } from './accountQueryKeys';
import { canAccessFeature, defaultProStatus, type FeatureAccessKey } from './accountModel';
import { setCurrentUserQueryData } from './accountQueryCache';
import { currentUserQueryOptions, entitlementsQueryOptions } from './accountQueryOptions';

export function getCachedCurrentUser(): UserProfile | null {
  return queryClient.getQueryData<UserProfile>(accountQueryKeys.currentUser) ?? null;
}

export function getCachedEntitlements(): EntitlementsResponse | null {
  return queryClient.getQueryData<EntitlementsResponse>(accountQueryKeys.entitlements) ?? null;
}

export function getCachedProStatus() {
  return getCachedEntitlements()?.proStatus ?? defaultProStatus;
}

export function getCachedFeatureAccess(feature: FeatureAccessKey) {
  return canAccessFeature(getCachedEntitlements(), feature);
}

export async function refreshCurrentUserQuery(accessToken: string) {
  return queryClient.fetchQuery({ ...currentUserQueryOptions(accessToken), staleTime: 0 });
}

export async function refreshEntitlementsQuery(accessToken: string) {
  return queryClient.fetchQuery({ ...entitlementsQueryOptions(accessToken), staleTime: 0 });
}

export function seedCurrentUser(user: AuthResponse['user']) {
  setCurrentUserQueryData(queryClient, user);
}

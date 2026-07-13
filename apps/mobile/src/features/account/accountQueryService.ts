import type { AuthResponse, EntitlementsResponse, UserProfile } from '@xiaotidu/contracts';

import { queryClient } from '../../api/queryClient';
import { queryKeys } from '../../api/queryKeys';
import { defaultProStatus } from './accountModel';
import { currentUserQueryOptions, entitlementsQueryOptions } from './accountQueryOptions';

export function getCachedCurrentUser(): UserProfile | null {
  return queryClient.getQueryData<UserProfile>(queryKeys.currentUser) ?? null;
}

export function getCachedEntitlements(): EntitlementsResponse | null {
  return queryClient.getQueryData<EntitlementsResponse>(queryKeys.entitlements) ?? null;
}

export function getCachedProStatus() {
  return getCachedEntitlements()?.proStatus ?? defaultProStatus;
}

export async function refreshCurrentUserQuery(accessToken: string) {
  return queryClient.fetchQuery({ ...currentUserQueryOptions(accessToken), staleTime: 0 });
}

export async function refreshEntitlementsQuery(accessToken: string) {
  return queryClient.fetchQuery({ ...entitlementsQueryOptions(accessToken), staleTime: 0 });
}

export function seedCurrentUser(user: AuthResponse['user']) {
  queryClient.setQueryData(queryKeys.currentUser, user);
}

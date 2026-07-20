import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UpdateUserProfileRequest } from '@xiaotidu/contracts';

import { usersApi } from '../../api/client';
import { useQueryErrorNotification } from '../../api/useQueryErrorNotification';
import { notifyUserError, useAuthStore } from './authStore';
import { accountQueryKeys } from './accountQueryKeys';
import { currentUserQueryOptions, entitlementsQueryOptions } from './accountQueryOptions';

type AccountQueryOptions = { enabled?: boolean };

export function useCurrentUserQuery(options: AccountQueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const query = useQuery({
    ...currentUserQueryOptions(accessToken ?? ''),
    enabled: Boolean((options.enabled ?? true) && accessToken),
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useEntitlementsQuery(options: AccountQueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const query = useQuery({
    ...entitlementsQueryOptions(accessToken ?? ''),
    enabled: Boolean((options.enabled ?? true) && accessToken),
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useUpdateProfileMutation() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateUserProfileRequest) => usersApi.updateUserProfile(input, requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: (user) => queryClient.setQueryData(accountQueryKeys.currentUser, user),
  });
}

function requireValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined || value === '') throw new Error('请先登录。');
  return value;
}

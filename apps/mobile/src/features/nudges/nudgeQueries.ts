import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { BuddyNudgeAckStatus, BuddyNudgeType, UpdateBuddyNudgeSettingsRequest } from '@xiaotidu/contracts';

import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useCurrentUserQuery } from '../account/accountQueries';
import { notifyUserError, useAuthStore } from '../account/authStore';
import { mergeNudges } from './nudgeModel';
import { invalidateNudgeQueries } from './nudgeQueryCache';
import { nudgeThreadQueryOptions, nudgeThreadsQueryOptions } from './nudgeQueryOptions';

type NudgeQueryOptions = {
  enabled?: boolean;
  refetchInterval?: false | number;
};

export function useNudgeThreadsQuery(options: NudgeQueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;

  return useQuery({
    ...nudgeThreadsQueryOptions(accessToken ?? '', userId ?? 'anonymous'),
    enabled: Boolean((options.enabled ?? true) && accessToken && userId),
    refetchInterval: options.refetchInterval,
  });
}

export function useNudgeThreadQuery(buddyUserId: string | undefined, options: NudgeQueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const query = useInfiniteQuery({
    ...nudgeThreadQueryOptions(accessToken ?? '', userId ?? 'anonymous', buddyUserId ?? 'unknown'),
    enabled: Boolean((options.enabled ?? true) && accessToken && userId && buddyUserId),
    refetchInterval: options.refetchInterval,
  });
  const items = useMemo(() => mergeNudges(query.data?.pages.flatMap((page) => page.nudges) ?? []), [query.data]);

  return { ...query, items };
}

export function useSendNudgeMutation(buddyUserId: string | undefined) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (type: BuddyNudgeType) =>
      apiClient.sendNudge({ toUserId: requireValue(buddyUserId), type }, requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: () => invalidateNudgeQueries(queryClient, userId, buddyUserId),
  });
}

export function useAckNudgeMutation(buddyUserId: string | undefined) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BuddyNudgeAckStatus }) =>
      apiClient.ackNudge(id, { status }, requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: () => invalidateNudgeQueries(queryClient, userId, buddyUserId),
  });
}

export function useNudgeSettingsQuery() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;

  return useQuery({
    enabled: Boolean(accessToken && userId),
    queryFn: () => apiClient.getBuddyNudgeSettings(requireValue(accessToken)),
    queryKey: queryKeys.nudgeSettings(userId ?? 'anonymous'),
  });
}

export function useUpdateNudgeSettingsMutation() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ buddyUserId, settings }: { buddyUserId: string; settings: UpdateBuddyNudgeSettingsRequest }) =>
      apiClient.updateBuddyNudgeSettings(buddyUserId, settings, requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: (response) => queryClient.setQueryData(queryKeys.nudgeSettings(userId ?? 'anonymous'), response),
  });
}

function requireValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined || value === '') throw new Error('请先登录。');
  return value;
}

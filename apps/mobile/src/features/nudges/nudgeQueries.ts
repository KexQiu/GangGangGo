import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type {
  BuddyNudgeAckStatus,
  BuddyNudgeThreadResponse,
  BuddyNudgeType,
  UpdateBuddyNudgeSettingsRequest,
} from '@xiaotidu/contracts';

import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { notifyUserError, useAuthStore } from '../account/authStore';
import { mergeNudges } from './nudgeModel';

const nudgeThreadPageSize = 30;

type NudgeQueryOptions = {
  enabled?: boolean;
  refetchInterval?: false | number;
};

export function useNudgeThreadsQuery(options: NudgeQueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);

  return useQuery({
    enabled: Boolean((options.enabled ?? true) && accessToken && userId),
    queryFn: ({ signal }) => apiClient.getNudgeThreads(requireValue(accessToken), signal),
    queryKey: queryKeys.nudgeThreads(userId ?? 'anonymous'),
    refetchInterval: options.refetchInterval,
  });
}

export function useNudgeThreadQuery(buddyUserId: string | undefined, options: NudgeQueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const query = useInfiniteQuery({
    enabled: Boolean((options.enabled ?? true) && accessToken && userId && buddyUserId),
    getNextPageParam: (lastPage: BuddyNudgeThreadResponse) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }): Promise<BuddyNudgeThreadResponse> =>
      apiClient.getNudgeThread(
        requireValue(buddyUserId),
        { before: pageParam, limit: nudgeThreadPageSize },
        requireValue(accessToken),
        signal,
      ),
    queryKey: queryKeys.nudgeThread(userId ?? 'anonymous', buddyUserId ?? 'unknown'),
    refetchInterval: options.refetchInterval,
  });
  const items = useMemo(() => mergeNudges(query.data?.pages.flatMap((page) => page.nudges) ?? []), [query.data]);

  return { ...query, items };
}

export function useSendNudgeMutation(buddyUserId: string | undefined) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
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
  const userId = useAuthStore((state) => state.user?.id);
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
  const userId = useAuthStore((state) => state.user?.id);

  return useQuery({
    enabled: Boolean(accessToken && userId),
    queryFn: () => apiClient.getBuddyNudgeSettings(requireValue(accessToken)),
    queryKey: queryKeys.nudgeSettings(userId ?? 'anonymous'),
  });
}

export function useUpdateNudgeSettingsMutation() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ buddyUserId, settings }: { buddyUserId: string; settings: UpdateBuddyNudgeSettingsRequest }) =>
      apiClient.updateBuddyNudgeSettings(buddyUserId, settings, requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: (response) => queryClient.setQueryData(queryKeys.nudgeSettings(userId ?? 'anonymous'), response),
  });
}

async function invalidateNudgeQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
  buddyUserId: string | undefined,
) {
  if (!userId) return;
  const invalidations: Promise<unknown>[] = [
    queryClient.invalidateQueries({ queryKey: queryKeys.nudgeThreads(userId) }),
  ];
  if (buddyUserId) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: queryKeys.nudgeThread(userId, buddyUserId) }));
  }
  await Promise.all(invalidations);
}

function requireValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined || value === '') throw new Error('请先登录。');
  return value;
}

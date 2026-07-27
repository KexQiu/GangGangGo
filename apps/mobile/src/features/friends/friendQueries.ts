import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type {
  FriendEvent,
  FriendEventsResponse,
  FriendNudgeAckStatus,
  FriendNudgeType,
  UpdateFriendSettingsRequest,
} from '@xiaotidu/contracts';

import { friendsApi } from '../../api/client';
import { useQueryErrorNotification } from '../../api/useQueryErrorNotification';
import { useCurrentUserQuery } from '../account/accountQueries';
import { notifyUserError, useAuthStore } from '../account/authStore';
import { friendQueryKeys } from './friendQueryKeys';
import { trackGrowthEvent } from '../growth/growthEventTracker';

type QueryOptions = { enabled?: boolean; refetchInterval?: false | number };

export function useFriendsQuery(options: QueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const query = useQuery({
    enabled: Boolean((options.enabled ?? true) && accessToken && userId),
    queryFn: ({ signal }) => friendsApi.list(requireValue(accessToken), signal),
    queryKey: friendQueryKeys.list(userId ?? 'anonymous'),
    refetchInterval: options.refetchInterval,
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useFriendQuery(friendUserId: string | undefined, options: QueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const query = useQuery({
    enabled: Boolean((options.enabled ?? true) && accessToken && userId && friendUserId),
    queryFn: ({ signal }) => friendsApi.getFriend(requireValue(friendUserId), requireValue(accessToken), signal),
    queryKey: friendQueryKeys.detail(userId ?? 'anonymous', friendUserId ?? 'unknown'),
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useFriendDataQuery(friendUserId: string | undefined, options: QueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const query = useQuery({
    enabled: Boolean((options.enabled ?? true) && accessToken && userId && friendUserId),
    queryFn: ({ signal }) => friendsApi.getData(requireValue(friendUserId), requireValue(accessToken), signal),
    queryKey: friendQueryKeys.data(userId ?? 'anonymous', friendUserId ?? 'unknown'),
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useFriendInvitePreviewQuery(token: string | undefined, options: QueryOptions = {}) {
  const query = useQuery({
    enabled: Boolean((options.enabled ?? true) && token),
    queryFn: ({ signal }) => friendsApi.getInvitePreview(requireValue(token), signal),
    queryKey: friendQueryKeys.invite(token ?? 'missing'),
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useFriendEventsQuery(friendUserId: string | undefined, options: QueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const query = useInfiniteQuery({
    enabled: Boolean((options.enabled ?? true) && accessToken && userId && friendUserId),
    getNextPageParam: (page: FriendEventsResponse) => (page.hasMore ? (page.nextCursor ?? undefined) : undefined),
    initialPageParam: null as null | string,
    queryFn: ({ pageParam, signal }): Promise<FriendEventsResponse> =>
      friendsApi.getEvents(
        requireValue(friendUserId),
        { before: pageParam, limit: 30 },
        requireValue(accessToken),
        signal,
      ),
    queryKey: friendQueryKeys.events(userId ?? 'anonymous', friendUserId ?? 'unknown'),
    refetchInterval: options.refetchInterval,
  });
  useQueryErrorNotification(query.error);
  const items = useMemo(() => mergeEvents(query.data?.pages.flatMap((page) => page.events) ?? []), [query.data]);
  return { ...query, items };
}

export function useCreateFriendInviteMutation() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useMutation({
    mutationFn: () => friendsApi.createInvite(requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: () => trackGrowthEvent('friend_invite_sent', { source: 'friend' }),
  });
}

export function useAcceptFriendInviteMutation() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => friendsApi.acceptInvite(token, requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: async () => {
      trackGrowthEvent('friend_invite_accepted', { source: 'friend' });
      await queryClient.invalidateQueries({ queryKey: friendQueryKeys.list(userId ?? 'anonymous') });
    },
  });
}

export function useUpdateFriendSettingsMutation(friendUserId: string | undefined) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateFriendSettingsRequest) =>
      friendsApi.updateSettings(requireValue(friendUserId), input, requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: async (response) => {
      queryClient.setQueryData(friendQueryKeys.detail(userId ?? 'anonymous', requireValue(friendUserId)), response);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: friendQueryKeys.data(userId ?? 'anonymous', requireValue(friendUserId)),
        }),
        queryClient.invalidateQueries({ queryKey: friendQueryKeys.list(userId ?? 'anonymous') }),
      ]);
    },
  });
}

export function useDeleteFriendMutation(friendUserId: string | undefined) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => friendsApi.deleteFriend(requireValue(friendUserId), requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: () => queryClient.removeQueries({ queryKey: ['friends', userId ?? 'anonymous'] }),
  });
}

export function useSendFriendNudgeMutation(friendUserId: string | undefined) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type: FriendNudgeType) =>
      friendsApi.sendNudge(requireValue(friendUserId), { type }, requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: () => invalidateFriendEvents(queryClient, userId, friendUserId),
  });
}

export function useAckFriendNudgeMutation(friendUserId: string | undefined) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: FriendNudgeAckStatus }) =>
      friendsApi.ackNudge(eventId, { status }, requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: () => invalidateFriendEvents(queryClient, userId, friendUserId),
  });
}

function invalidateFriendEvents(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
  friendUserId: string | undefined,
) {
  if (!userId || !friendUserId) return Promise.resolve();
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: friendQueryKeys.events(userId, friendUserId) }),
    queryClient.invalidateQueries({ queryKey: friendQueryKeys.list(userId) }),
  ]);
}

function mergeEvents(events: FriendEvent[]) {
  const byId = new Map(events.map((event) => [event.id, event]));
  return [...byId.values()].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

function requireValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined || value === '') throw new Error('请先登录。');
  return value;
}

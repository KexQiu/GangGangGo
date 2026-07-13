import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AcceptTeamInviteRequest,
  ShareSettings,
  TeamResponse,
  UpdateTeamMemberStatusRequest,
} from '@xiaotidu/contracts';

import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useQueryErrorNotification } from '../../api/useQueryErrorNotification';
import { useCurrentUserQuery } from '../account/accountQueries';
import { notifyUserError, useAuthStore } from '../account/authStore';
import { invalidateTeamSnapshots, updateTeamQueryCache, type TeamCacheUpdateOptions } from './teamQueryCache';

const defaultShareSettings: ShareSettings = {
  paused: false,
  shareHabitCompletion: true,
  shareStreak: true,
  shareToiletRecorded: true,
  shareTraining: true,
};

type QueryOptions = { enabled?: boolean };

export function useCurrentTeamQuery(options: QueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;

  const query = useQuery({
    enabled: Boolean((options.enabled ?? true) && accessToken && userId),
    queryFn: ({ signal }) => apiClient.getCurrentTeam(requireValue(accessToken), signal),
    queryKey: queryKeys.team(userId ?? 'anonymous'),
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useTeamSnapshotsQuery(options: QueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;

  const query = useQuery({
    enabled: Boolean((options.enabled ?? true) && accessToken && userId),
    queryFn: ({ signal }) => apiClient.getTeamSnapshots(requireValue(accessToken), signal),
    queryKey: queryKeys.teamSnapshots(userId ?? 'anonymous'),
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useTeamInvitePreviewQuery(token: string | undefined, options: QueryOptions = {}) {
  const query = useQuery({
    enabled: Boolean((options.enabled ?? true) && token),
    queryFn: ({ signal }) => apiClient.getTeamInvitePreview(requireValue(token), signal),
    queryKey: queryKeys.invitePreview(token ?? 'missing'),
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useCreateTeamMutation() {
  return useTeamMutation((name: string | undefined, accessToken) => apiClient.createTeam({ name }, accessToken));
}

export function useCreateTeamInviteMutation() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useMutation({
    mutationFn: () => apiClient.createTeamInvite(requireValue(accessToken)),
    onError: notifyUserError,
  });
}

export function useAcceptTeamInviteMutation() {
  return useTeamMutation(
    (input: { request?: AcceptTeamInviteRequest; token: string }, accessToken) =>
      apiClient.acceptTeamInvite(input.token, { shareSettings: defaultShareSettings, ...input.request }, accessToken),
    { invalidateSnapshots: true },
  );
}

export function useLeaveTeamMutation() {
  return useTeamMutation((_input: void, accessToken) => apiClient.leaveTeam(accessToken), {
    clearSnapshotsWhenTeamMissing: true,
  });
}

export function useRemoveTeamMemberMutation() {
  return useTeamMutation((memberId: string, accessToken) => apiClient.removeMember(memberId, accessToken), {
    invalidateSnapshots: true,
  });
}

export function useRenameTeamMutation() {
  return useTeamMutation((name: string, accessToken) => apiClient.updateTeam({ name }, accessToken));
}

export function useUpdateMyMemberStatusMutation() {
  return useTeamMutation(
    (status: UpdateTeamMemberStatusRequest['status'], accessToken) =>
      apiClient.updateMyMemberStatus({ status }, accessToken),
    { invalidateSnapshots: true },
  );
}

export function useUpdateShareSettingsMutation() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: ShareSettings) => apiClient.updateShareSettings(settings, requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: () => invalidateTeamSnapshots(queryClient, userId),
  });
}

function useTeamMutation<TInput>(
  mutationFn: (input: TInput, accessToken: string) => Promise<TeamResponse>,
  options: TeamCacheUpdateOptions = {},
) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TInput) => mutationFn(input, requireValue(accessToken)),
    onError: notifyUserError,
    onSuccess: (response) => updateTeamQueryCache(queryClient, userId, response, options),
  });
}

function requireValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined || value === '') throw new Error('请先登录。');
  return value;
}

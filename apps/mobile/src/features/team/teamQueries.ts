import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AcceptTeamInviteRequest,
  ShareSettings,
  TeamResponse,
  UpdateTeamMemberStatusRequest,
} from '@xiaotidu/contracts';

import { teamsApi } from '../../api/client';
import { useQueryErrorNotification } from '../../api/useQueryErrorNotification';
import { useCurrentUserQuery } from '../account/accountQueries';
import { notifyUserError, useAuthStore } from '../account/authStore';
import { invalidateTeamSnapshots, updateTeamQueryCache, type TeamCacheUpdateOptions } from './teamQueryCache';
import { teamQueryKeys } from './teamQueryKeys';

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
    queryFn: ({ signal }) => teamsApi.getCurrentTeam(requireValue(accessToken), signal),
    queryKey: teamQueryKeys.team(userId ?? 'anonymous'),
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useTeamSnapshotsQuery(options: QueryOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;

  const query = useQuery({
    enabled: Boolean((options.enabled ?? true) && accessToken && userId),
    queryFn: ({ signal }) => teamsApi.getTeamSnapshots(requireValue(accessToken), signal),
    queryKey: teamQueryKeys.teamSnapshots(userId ?? 'anonymous'),
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useTeamInvitePreviewQuery(token: string | undefined, options: QueryOptions = {}) {
  const query = useQuery({
    enabled: Boolean((options.enabled ?? true) && token),
    queryFn: ({ signal }) => teamsApi.getTeamInvitePreview(requireValue(token), signal),
    queryKey: teamQueryKeys.invitePreview(token ?? 'missing'),
  });
  useQueryErrorNotification(query.error);
  return query;
}

export function useCreateTeamMutation() {
  return useTeamMutation((name: string | undefined, accessToken) => teamsApi.createTeam({ name }, accessToken));
}

export function useCreateTeamInviteMutation() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useMutation({
    mutationFn: () => teamsApi.createTeamInvite(requireValue(accessToken)),
    onError: notifyUserError,
  });
}

export function useAcceptTeamInviteMutation() {
  return useTeamMutation(
    (input: { request?: AcceptTeamInviteRequest; token: string }, accessToken) =>
      teamsApi.acceptTeamInvite(input.token, { shareSettings: defaultShareSettings, ...input.request }, accessToken),
    { invalidateSnapshots: true },
  );
}

export function useLeaveTeamMutation() {
  return useTeamMutation((_input: void, accessToken) => teamsApi.leaveTeam(accessToken), {
    clearSnapshotsWhenTeamMissing: true,
  });
}

export function useRemoveTeamMemberMutation() {
  return useTeamMutation((memberId: string, accessToken) => teamsApi.removeMember(memberId, accessToken), {
    invalidateSnapshots: true,
  });
}

export function useRenameTeamMutation() {
  return useTeamMutation((name: string, accessToken) => teamsApi.updateTeam({ name }, accessToken));
}

export function useUpdateMyMemberStatusMutation() {
  return useTeamMutation(
    (status: UpdateTeamMemberStatusRequest['status'], accessToken) =>
      teamsApi.updateMyMemberStatus({ status }, accessToken),
    { invalidateSnapshots: true },
  );
}

export function useUpdateShareSettingsMutation() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useCurrentUserQuery().data?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: ShareSettings) => teamsApi.updateShareSettings(settings, requireValue(accessToken)),
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

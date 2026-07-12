import { create } from 'zustand';

import type {
  AcceptTeamInviteRequest,
  CreateTeamInviteResponse,
  ShareSettings,
  Team,
  TeamInvitePreviewResponse,
  TeamSnapshotsResponse,
  UpdateTeamMemberStatusRequest,
} from '@xiaotidu/contracts';

import { ApiClientError, apiClient } from '../../api/client';
import { queryClient } from '../../api/queryClient';
import { queryKeys } from '../../api/queryKeys';
import { notifyUserError, useAuthStore } from '../account/authStore';

type TeamState = {
  error: null | string;
  invite: CreateTeamInviteResponse | null;
  invitePreview: TeamInvitePreviewResponse | null;
  isLoading: boolean;
  isMutating: boolean;
  snapshots: TeamSnapshotsResponse | null;
  team: Team | null;
  acceptInvite: (token: string, request?: AcceptTeamInviteRequest) => Promise<boolean>;
  createInvite: () => Promise<void>;
  createTeam: (name?: string) => Promise<void>;
  leaveTeam: () => Promise<void>;
  loadCurrentTeam: () => Promise<void>;
  loadInvitePreview: (token: string) => Promise<void>;
  loadSnapshots: () => Promise<void>;
  removeMember: (memberId: string) => Promise<boolean>;
  renameTeam: (name: string) => Promise<void>;
  updateMyMemberStatus: (status: UpdateTeamMemberStatusRequest['status']) => Promise<void>;
  updateShareSettings: (settings: ShareSettings) => Promise<void>;
};

const defaultShareSettings: ShareSettings = {
  paused: false,
  shareHabitCompletion: true,
  shareStreak: true,
  shareToiletRecorded: true,
  shareTraining: true,
};

export const useTeamStore = create<TeamState>((set, get) => ({
  acceptInvite: async (token, request = {}) => {
    set({ error: null, isMutating: true });

    try {
      const accessToken = requireAccessToken();
      const response = await apiClient.acceptTeamInvite(
        token,
        {
          shareSettings: defaultShareSettings,
          ...request,
        },
        accessToken,
      );
      set({ error: null, isMutating: false, team: response.team });
      await get().loadSnapshots();
      return true;
    } catch (error) {
      set({ error: notifyUserError(error), isMutating: false });
      return false;
    }
  },
  createInvite: async () => {
    set({ error: null, isMutating: true });

    try {
      const accessToken = requireAccessToken();
      const invite = await apiClient.createTeamInvite(accessToken);
      set({ error: null, invite, isMutating: false });
    } catch (error) {
      set({ error: notifyUserError(error), isMutating: false });
    }
  },
  createTeam: async (name = '我的小队') => {
    set({ error: null, isMutating: true });

    try {
      const accessToken = requireAccessToken();
      const response = await apiClient.createTeam({ name }, accessToken);
      set({ error: null, isMutating: false, team: response.team });
      await get().loadSnapshots();
    } catch (error) {
      set({ error: notifyUserError(error), isMutating: false });
    }
  },
  error: null,
  invite: null,
  invitePreview: null,
  isLoading: false,
  isMutating: false,
  leaveTeam: async () => {
    set({ error: null, isMutating: true });

    try {
      const accessToken = requireAccessToken();
      const response = await apiClient.leaveTeam(accessToken);
      set({ error: null, isMutating: false, snapshots: null, team: response.team });
    } catch (error) {
      set({ error: notifyUserError(error), isMutating: false });
    }
  },
  loadCurrentTeam: async () => {
    const accessToken = useAuthStore.getState().accessToken;

    if (!accessToken) {
      set({ snapshots: null, team: null });
      return;
    }

    set({ error: null, isLoading: true });

    try {
      const userId = useAuthStore.getState().user?.id ?? 'anonymous';
      const response = await queryClient.fetchQuery({
        queryFn: () => apiClient.getCurrentTeam(accessToken),
        queryKey: queryKeys.team(userId),
      });
      set({ error: null, isLoading: false, team: response.team });

      if (response.team) {
        await get().loadSnapshots();
      } else {
        set({ snapshots: null });
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        await useAuthStore.getState().logout();
      }

      set({ error: notifyUserError(error), isLoading: false });
    }
  },
  loadInvitePreview: async (token) => {
    set({ error: null, invitePreview: null, isLoading: true });

    try {
      const invitePreview = await queryClient.fetchQuery({
        queryFn: () => apiClient.getTeamInvitePreview(token),
        queryKey: queryKeys.invitePreview(token),
      });
      set({ error: null, invitePreview, isLoading: false });
    } catch (error) {
      set({ error: notifyUserError(error), isLoading: false });
    }
  },
  loadSnapshots: async () => {
    const accessToken = useAuthStore.getState().accessToken;

    if (!accessToken) {
      set({ snapshots: null });
      return;
    }

    try {
      const userId = useAuthStore.getState().user?.id ?? 'anonymous';
      const snapshots = await queryClient.fetchQuery({
        queryFn: () => apiClient.getTeamSnapshots(accessToken),
        queryKey: queryKeys.teamSnapshots(userId),
      });
      set({ error: null, snapshots });
    } catch (error) {
      set({ error: notifyUserError(error) });
    }
  },
  removeMember: async (memberId) => {
    set({ error: null, isMutating: true });

    try {
      const accessToken = requireAccessToken();
      const response = await apiClient.removeMember(memberId, accessToken);
      set({ error: null, isMutating: false, team: response.team });
      await get().loadSnapshots();
      return true;
    } catch (error) {
      set({ error: notifyUserError(error), isMutating: false });
      return false;
    }
  },
  renameTeam: async (name) => {
    set({ error: null, isMutating: true });

    try {
      const accessToken = requireAccessToken();
      const response = await apiClient.updateTeam({ name }, accessToken);
      set({ error: null, isMutating: false, team: response.team });
    } catch (error) {
      set({ error: notifyUserError(error), isMutating: false });
    }
  },
  snapshots: null,
  team: null,
  updateMyMemberStatus: async (status) => {
    set({ error: null, isMutating: true });

    try {
      const accessToken = requireAccessToken();
      const response = await apiClient.updateMyMemberStatus({ status }, accessToken);
      set({ error: null, isMutating: false, team: response.team });
      await get().loadSnapshots();
    } catch (error) {
      set({ error: notifyUserError(error), isMutating: false });
    }
  },
  updateShareSettings: async (settings) => {
    set({ error: null, isMutating: true });

    try {
      const accessToken = requireAccessToken();
      await apiClient.updateShareSettings(settings, accessToken);
      set({ error: null, isMutating: false });
      await get().loadSnapshots();
    } catch (error) {
      set({ error: notifyUserError(error), isMutating: false });
    }
  },
}));

function requireAccessToken(): string {
  const token = useAuthStore.getState().accessToken;

  if (!token) {
    throw new Error('请先登录。');
  }

  return token;
}

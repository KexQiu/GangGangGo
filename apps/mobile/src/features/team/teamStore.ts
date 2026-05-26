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
import { useAuthStore, toUserMessage } from '../account/authStore';

type TeamState = {
  error: null | string;
  invite: CreateTeamInviteResponse | null;
  invitePreview: TeamInvitePreviewResponse | null;
  isLoading: boolean;
  isMutating: boolean;
  snapshots: TeamSnapshotsResponse | null;
  team: Team | null;
  acceptInvite: (token: string, request?: AcceptTeamInviteRequest) => Promise<void>;
  createInvite: () => Promise<void>;
  createTeam: (name?: string) => Promise<void>;
  leaveTeam: () => Promise<void>;
  loadCurrentTeam: () => Promise<void>;
  loadInvitePreview: (token: string) => Promise<void>;
  loadSnapshots: () => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
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
    const accessToken = requireAccessToken();
    set({ error: null, isMutating: true });

    try {
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
    } catch (error) {
      set({ error: toUserMessage(error), isMutating: false });
      throw error;
    }
  },
  createInvite: async () => {
    const accessToken = requireAccessToken();
    set({ error: null, isMutating: true });

    try {
      const invite = await apiClient.createTeamInvite(accessToken);
      set({ error: null, invite, isMutating: false });
    } catch (error) {
      set({ error: toUserMessage(error), isMutating: false });
      throw error;
    }
  },
  createTeam: async (name = '我的小队') => {
    const accessToken = requireAccessToken();
    set({ error: null, isMutating: true });

    try {
      const response = await apiClient.createTeam({ name }, accessToken);
      set({ error: null, isMutating: false, team: response.team });
      await get().loadSnapshots();
    } catch (error) {
      set({ error: toUserMessage(error), isMutating: false });
      throw error;
    }
  },
  error: null,
  invite: null,
  invitePreview: null,
  isLoading: false,
  isMutating: false,
  leaveTeam: async () => {
    const accessToken = requireAccessToken();
    set({ error: null, isMutating: true });

    try {
      const response = await apiClient.leaveTeam(accessToken);
      set({ error: null, isMutating: false, snapshots: null, team: response.team });
    } catch (error) {
      set({ error: toUserMessage(error), isMutating: false });
      throw error;
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
      const response = await apiClient.getCurrentTeam(accessToken);
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

      set({ error: toUserMessage(error), isLoading: false });
    }
  },
  loadInvitePreview: async (token) => {
    set({ error: null, invitePreview: null, isLoading: true });

    try {
      const invitePreview = await apiClient.getTeamInvitePreview(token);
      set({ error: null, invitePreview, isLoading: false });
    } catch (error) {
      set({ error: toUserMessage(error), isLoading: false });
    }
  },
  loadSnapshots: async () => {
    const accessToken = useAuthStore.getState().accessToken;

    if (!accessToken) {
      set({ snapshots: null });
      return;
    }

    try {
      const snapshots = await apiClient.getTeamSnapshots(accessToken);
      set({ error: null, snapshots });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },
  removeMember: async (memberId) => {
    const accessToken = requireAccessToken();
    set({ error: null, isMutating: true });

    try {
      const response = await apiClient.removeMember(memberId, accessToken);
      set({ error: null, isMutating: false, team: response.team });
      await get().loadSnapshots();
    } catch (error) {
      set({ error: toUserMessage(error), isMutating: false });
      throw error;
    }
  },
  renameTeam: async (name) => {
    const accessToken = requireAccessToken();
    set({ error: null, isMutating: true });

    try {
      const response = await apiClient.updateTeam({ name }, accessToken);
      set({ error: null, isMutating: false, team: response.team });
    } catch (error) {
      set({ error: toUserMessage(error), isMutating: false });
      throw error;
    }
  },
  snapshots: null,
  team: null,
  updateMyMemberStatus: async (status) => {
    const accessToken = requireAccessToken();
    set({ error: null, isMutating: true });

    try {
      const response = await apiClient.updateMyMemberStatus({ status }, accessToken);
      set({ error: null, isMutating: false, team: response.team });
      await get().loadSnapshots();
    } catch (error) {
      set({ error: toUserMessage(error), isMutating: false });
      throw error;
    }
  },
  updateShareSettings: async (settings) => {
    const accessToken = requireAccessToken();
    set({ error: null, isMutating: true });

    try {
      await apiClient.updateShareSettings(settings, accessToken);
      set({ error: null, isMutating: false });
      await get().loadSnapshots();
    } catch (error) {
      set({ error: toUserMessage(error), isMutating: false });
      throw error;
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

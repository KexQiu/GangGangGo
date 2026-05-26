import { create } from 'zustand';

import type {
  BuddyNudge,
  BuddyNudgeAckStatus,
  BuddyNudgeSettings,
  BuddyNudgeType,
  UpdateBuddyNudgeSettingsRequest,
} from '@xiaotidu/contracts';

import { apiClient } from '../../api/client';
import { toUserMessage, useAuthStore } from '../account/authStore';

type NudgeState = {
  error: null | string;
  inbox: BuddyNudge[];
  isLoading: boolean;
  isMutating: boolean;
  sent: BuddyNudge[];
  settings: BuddyNudgeSettings[];
  ackNudge: (id: string, status: BuddyNudgeAckStatus) => Promise<void>;
  loadInbox: () => Promise<void>;
  loadSent: () => Promise<void>;
  loadSettings: () => Promise<void>;
  sendNudge: (toUserId: string, type: BuddyNudgeType) => Promise<void>;
  updateSettings: (buddyUserId: string, settings: UpdateBuddyNudgeSettingsRequest) => Promise<void>;
};

export const nudgeCopies: Record<BuddyNudgeType, string> = {
  gentle: '轻轻戳一下',
  habit_left: '小账本还差一点',
  move: '起来活动一下',
  not_blank: '今天别空白',
  posture: '该换个姿势了',
};

export const ackCopies: Record<BuddyNudgeAckStatus, string> = {
  done: '已完成',
  later: '等会儿',
  received: '收到',
};

export const useNudgeStore = create<NudgeState>((set, get) => ({
  ackNudge: async (id, status) => {
    const token = requireAccessToken();
    set({ error: null, isMutating: true });

    try {
      await apiClient.ackNudge(id, { status }, token);
      set({ error: null, isMutating: false });
      await get().loadInbox();
    } catch (error) {
      set({ error: toUserMessage(error), isMutating: false });
      throw error;
    }
  },
  error: null,
  inbox: [],
  isLoading: false,
  isMutating: false,
  loadInbox: async () => {
    const token = useAuthStore.getState().accessToken;

    if (!token) {
      set({ inbox: [] });
      return;
    }

    set({ error: null, isLoading: true });

    try {
      const response = await apiClient.getNudgeInbox(token);
      set({ error: null, inbox: response.nudges, isLoading: false });
    } catch (error) {
      set({ error: toUserMessage(error), isLoading: false });
    }
  },
  loadSent: async () => {
    const token = useAuthStore.getState().accessToken;

    if (!token) {
      set({ sent: [] });
      return;
    }

    set({ error: null, isLoading: true });

    try {
      const response = await apiClient.getNudgeSent(token);
      set({ error: null, isLoading: false, sent: response.nudges });
    } catch (error) {
      set({ error: toUserMessage(error), isLoading: false });
    }
  },
  loadSettings: async () => {
    const token = useAuthStore.getState().accessToken;

    if (!token) {
      set({ settings: [] });
      return;
    }

    try {
      const response = await apiClient.getBuddyNudgeSettings(token);
      set({ error: null, settings: response.settings });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },
  sendNudge: async (toUserId, type) => {
    const token = requireAccessToken();
    set({ error: null, isMutating: true });

    try {
      await apiClient.sendNudge({ toUserId, type }, token);
      set({ error: null, isMutating: false });
      await get().loadSent();
    } catch (error) {
      set({ error: toUserMessage(error), isMutating: false });
      throw error;
    }
  },
  sent: [],
  settings: [],
  updateSettings: async (buddyUserId, settings) => {
    const token = requireAccessToken();
    set({ error: null, isMutating: true });

    try {
      const response = await apiClient.updateBuddyNudgeSettings(buddyUserId, settings, token);
      set({ error: null, isMutating: false, settings: response.settings });
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

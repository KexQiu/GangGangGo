import { create } from 'zustand';

import type {
  BuddyNudge,
  BuddyNudgeAckStatus,
  BuddyNudgeSettings,
  BuddyNudgeType,
  TeamMember,
  UpdateBuddyNudgeSettingsRequest,
} from '@xiaotidu/contracts';

import { apiClient } from '../../api/client';
import { notifyUserError, useAuthStore } from '../account/authStore';

type NudgeState = {
  error: null | string;
  inbox: BuddyNudge[];
  isLoading: boolean;
  isMutating: boolean;
  sent: BuddyNudge[];
  settings: BuddyNudgeSettings[];
  threadByBuddyUserId: Record<string, NudgeThreadState>;
  ackNudge: (id: string, status: BuddyNudgeAckStatus, buddyUserId?: string) => Promise<void>;
  loadInbox: () => Promise<void>;
  loadSent: () => Promise<void>;
  loadThread: (buddyUserId: string, mode?: NudgeThreadLoadMode) => Promise<void>;
  loadThreads: (options?: NudgeThreadsLoadOptions) => Promise<void>;
  loadSettings: () => Promise<void>;
  sendNudge: (toUserId: string, type: BuddyNudgeType) => Promise<void>;
  updateSettings: (buddyUserId: string, settings: UpdateBuddyNudgeSettingsRequest) => Promise<void>;
};

type NudgeThreadLoadMode = 'initial' | 'older' | 'refresh';

type NudgeThreadsLoadOptions = {
  silent?: boolean;
};

type NudgeBuddy = BuddyNudge['fromUser'];

export type NudgeThread = {
  buddy: NudgeBuddy;
  latestAt: null | string;
  latestPreview: string;
  messageCount: number;
  pendingCount: number;
  status: TeamMember['status'] | null;
};

export type NudgeChatMessage = {
  createdAt: string;
  direction: 'incoming' | 'outgoing';
  id: string;
  nudge: BuddyNudge;
  sender: NudgeBuddy;
  text: string;
};

export type NudgeThreadState = {
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  items: BuddyNudge[];
  nextCursor: null | string;
};

export type NudgeHomeSummary = {
  latestAt: null | string;
  latestPreview: null | string;
  pendingCount: number;
};

export const nudgeCopies: Record<BuddyNudgeType, string> = {
  gentle: '轻轻戳一下',
  habit_left: '补一笔小账',
  move: '走两步',
  not_blank: '留个小进展',
  posture: '肩颈放松',
};

export const nudgeActionTypes: BuddyNudgeType[] = ['move', 'not_blank', 'habit_left', 'posture'];

export const ackCopies: Record<BuddyNudgeAckStatus, string> = {
  done: '已完成',
  later: '等会儿',
  received: '收到',
};

export const ackStatuses: BuddyNudgeAckStatus[] = ['received', 'later', 'done'];
const nudgeThreadPageSize = 30;

const emptyThreadState: NudgeThreadState = {
  hasMore: true,
  isLoading: false,
  isLoadingMore: false,
  items: [],
  nextCursor: null,
};

export const useNudgeStore = create<NudgeState>((set, get) => ({
  ackNudge: async (id, status, buddyUserId) => {
    set({ error: null, isMutating: true });

    try {
      const token = requireAccessToken();
      await apiClient.ackNudge(id, { status }, token);
      set({ error: null, isMutating: false });
      if (buddyUserId) {
        await get().loadThread(buddyUserId, 'initial');
      }
      await get().loadThreads();
    } catch (error) {
      set({ error: notifyUserError(error), isMutating: false });
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
      console.info('[nudges] loadInbox', {
        count: response.nudges.length,
        userId: useAuthStore.getState().user?.id ?? null,
      });
      set({ error: null, inbox: response.nudges, isLoading: false });
    } catch (error) {
      console.info('[nudges] loadInbox failed', error);
      set({ error: notifyUserError(error), isLoading: false });
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
      console.info('[nudges] loadSent', {
        count: response.nudges.length,
        userId: useAuthStore.getState().user?.id ?? null,
      });
      set({ error: null, isLoading: false, sent: response.nudges });
    } catch (error) {
      console.info('[nudges] loadSent failed', error);
      set({ error: notifyUserError(error), isLoading: false });
    }
  },
  loadThread: async (buddyUserId, mode = 'initial') => {
    const token = useAuthStore.getState().accessToken;
    const isSilentRefresh = mode === 'refresh';

    if (!token) {
      set((state) => ({
        threadByBuddyUserId: {
          ...state.threadByBuddyUserId,
          [buddyUserId]: { ...emptyThreadState, hasMore: false },
        },
      }));
      return;
    }

    const currentThread = get().threadByBuddyUserId[buddyUserId] ?? emptyThreadState;

    if (mode === 'older' && (!currentThread.hasMore || currentThread.isLoadingMore)) {
      return;
    }

    if (!isSilentRefresh) {
      set((state) => ({
        error: null,
        threadByBuddyUserId: {
          ...state.threadByBuddyUserId,
          [buddyUserId]: {
            ...(state.threadByBuddyUserId[buddyUserId] ?? emptyThreadState),
            isLoading: mode === 'initial',
            isLoadingMore: mode === 'older',
          },
        },
      }));
    }

    try {
      const response = await apiClient.getNudgeThread(
        buddyUserId,
        {
          before: mode === 'older' ? currentThread.nextCursor : null,
          limit: nudgeThreadPageSize,
        },
        token,
      );

      set((state) => {
        const previousThread = state.threadByBuddyUserId[buddyUserId] ?? emptyThreadState;
        const items = getMergedThreadItems({
          mode,
          previousItems: previousThread.items,
          responseItems: response.nudges,
        });
        const shouldPreserveOlderCursor = mode === 'refresh' && previousThread.items.length > response.nudges.length;

        return {
          error: null,
          threadByBuddyUserId: {
            ...state.threadByBuddyUserId,
            [buddyUserId]: {
              hasMore: shouldPreserveOlderCursor ? previousThread.hasMore : response.hasMore,
              isLoading: false,
              isLoadingMore: false,
              items,
              nextCursor: shouldPreserveOlderCursor ? previousThread.nextCursor : response.nextCursor,
            },
          },
        };
      });
    } catch (error) {
      if (isSilentRefresh) {
        console.info('[nudges] refreshThread failed', error);
        return;
      }

      set((state) => ({
        error: notifyUserError(error),
        threadByBuddyUserId: {
          ...state.threadByBuddyUserId,
          [buddyUserId]: {
            ...(state.threadByBuddyUserId[buddyUserId] ?? emptyThreadState),
            isLoading: false,
            isLoadingMore: false,
          },
        },
      }));
    }
  },
  loadThreads: async (options = {}) => {
    const token = useAuthStore.getState().accessToken;
    const isSilent = options.silent === true;

    if (!token) {
      set({ inbox: [], sent: [] });
      return;
    }

    if (!isSilent) {
      set({ error: null, isLoading: true });
    }

    try {
      const [inboxResponse, sentResponse] = await Promise.all([
        apiClient.getNudgeInbox(token),
        apiClient.getNudgeSent(token),
      ]);
      console.info('[nudges] loadThreads', {
        inboxCount: inboxResponse.nudges.length,
        sentCount: sentResponse.nudges.length,
        userId: useAuthStore.getState().user?.id ?? null,
      });
      set({
        error: null,
        inbox: inboxResponse.nudges,
        ...(isSilent ? {} : { isLoading: false }),
        sent: sentResponse.nudges,
      });
    } catch (error) {
      console.info('[nudges] loadThreads failed', error);
      if (!isSilent) {
        set({ error: notifyUserError(error), isLoading: false });
      }
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
      set({ error: notifyUserError(error) });
    }
  },
  sendNudge: async (toUserId, type) => {
    set({ error: null, isMutating: true });

    try {
      const token = requireAccessToken();
      const nudge = await apiClient.sendNudge({ toUserId, type }, token);
      console.info('[nudges] sendNudge succeeded', {
        fromUserId: useAuthStore.getState().user?.id ?? null,
        nudgeId: nudge.id,
        toUserId,
        type,
      });
      set((state) => ({ error: null, isMutating: false, sent: mergeNudges([nudge, ...state.sent]) }));
      await get().loadThread(toUserId, 'initial');
      await get().loadThreads();
    } catch (error) {
      console.info('[nudges] sendNudge failed', {
        error,
        fromUserId: useAuthStore.getState().user?.id ?? null,
        toUserId,
        type,
      });
      set({ error: notifyUserError(error), isMutating: false });
    }
  },
  sent: [],
  settings: [],
  threadByBuddyUserId: {},
  updateSettings: async (buddyUserId, settings) => {
    set({ error: null, isMutating: true });

    try {
      const token = requireAccessToken();
      const response = await apiClient.updateBuddyNudgeSettings(buddyUserId, settings, token);
      set({ error: null, isMutating: false, settings: response.settings });
    } catch (error) {
      set({ error: notifyUserError(error), isMutating: false });
    }
  },
}));

export function getNudgeThreads(input: {
  currentUserId: null | string | undefined;
  inbox: BuddyNudge[];
  members?: TeamMember[];
  sent: BuddyNudge[];
}): NudgeThread[] {
  if (!input.currentUserId) {
    return [];
  }

  const threadsByBuddyId = new Map<string, NudgeThread>();

  input.members
    ?.filter((member) => member.user.id !== input.currentUserId && member.status !== 'removed')
    .forEach((member) => {
      threadsByBuddyId.set(member.user.id, {
        buddy: member.user,
        latestAt: null,
        latestPreview: '还没有互动，发个小暗号开始。',
        messageCount: 0,
        pendingCount: 0,
        status: member.status,
      });
    });

  for (const nudge of mergeNudges([...input.inbox, ...input.sent])) {
    const buddy = getNudgeBuddy(nudge, input.currentUserId);

    if (!buddy) {
      continue;
    }

    const existingThread = threadsByBuddyId.get(buddy.id) ?? {
      buddy,
      latestAt: null,
      latestPreview: '还没有互动，发个小暗号开始。',
      messageCount: 0,
      pendingCount: 0,
      status: findMemberStatus(input.members, buddy.id),
    };
    const latestActivity = getLatestActivityForNudge(nudge, input.currentUserId);

    if (nudge.toUser.id === input.currentUserId && !nudge.ack) {
      existingThread.pendingCount += 1;
    }

    existingThread.messageCount += 1;

    if (isAfter(latestActivity.createdAt, existingThread.latestAt)) {
      existingThread.latestAt = latestActivity.createdAt;
      existingThread.latestPreview = formatThreadPreview(latestActivity);
    }

    threadsByBuddyId.set(buddy.id, existingThread);
  }

  return [...threadsByBuddyId.values()].sort((left, right) => {
    if (left.latestAt && right.latestAt) {
      return new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime();
    }

    if (left.latestAt) {
      return -1;
    }

    if (right.latestAt) {
      return 1;
    }

    return getDisplayName(left.buddy).localeCompare(getDisplayName(right.buddy), 'zh-CN');
  });
}

export function getNudgeChatMessages(input: {
  currentUserId: null | string | undefined;
  nudges: BuddyNudge[];
}): NudgeChatMessage[] {
  if (!input.currentUserId) {
    return [];
  }

  const currentUserId = input.currentUserId;

  return mergeNudges(input.nudges)
    .map((nudge) => getMessageForNudge(nudge, currentUserId))
    .sort(sortMessagesAsc);
}

export function getNudgeHomeSummary(input: {
  currentUserId: null | string | undefined;
  inbox: BuddyNudge[];
  sent: BuddyNudge[];
}): NudgeHomeSummary {
  const threads = getNudgeThreads(input);
  const pendingCount = threads.reduce((total, thread) => total + thread.pendingCount, 0);
  const latestThread = threads.find((thread) => thread.latestAt);

  return {
    latestAt: latestThread?.latestAt ?? null,
    latestPreview: latestThread?.latestPreview ?? null,
    pendingCount,
  };
}

export function getDisplayName(user: NudgeBuddy): string {
  return user.nickname ?? '小提督搭子';
}

function requireAccessToken(): string {
  const token = useAuthStore.getState().accessToken;

  if (!token) {
    throw new Error('请先登录。');
  }

  return token;
}

function mergeNudges(nudges: BuddyNudge[]): BuddyNudge[] {
  const nudgesById = new Map<string, BuddyNudge>();

  for (const nudge of nudges) {
    const existingNudge = nudgesById.get(nudge.id);

    if (!existingNudge || isAfter(nudge.createdAt, existingNudge.createdAt)) {
      nudgesById.set(nudge.id, nudge);
    }
  }

  return [...nudgesById.values()];
}

function getMergedThreadItems(input: {
  mode: NudgeThreadLoadMode;
  previousItems: BuddyNudge[];
  responseItems: BuddyNudge[];
}): BuddyNudge[] {
  if (input.mode === 'older') {
    return mergeNudges([...input.previousItems, ...input.responseItems]);
  }

  if (input.mode === 'refresh') {
    return mergeNudges([...input.responseItems, ...input.previousItems]);
  }

  return input.responseItems;
}

function getNudgeBuddy(nudge: BuddyNudge, currentUserId: string): NudgeBuddy | null {
  if (nudge.fromUser.id === currentUserId) {
    return nudge.toUser;
  }

  if (nudge.toUser.id === currentUserId) {
    return nudge.fromUser;
  }

  return null;
}

function getMessageForNudge(nudge: BuddyNudge, currentUserId: string): NudgeChatMessage {
  const direction: NudgeChatMessage['direction'] = nudge.fromUser.id === currentUserId ? 'outgoing' : 'incoming';

  return {
    createdAt: nudge.createdAt,
    direction,
    id: nudge.id,
    nudge,
    sender: nudge.fromUser,
    text: nudge.messageTemplate,
  };
}

function getLatestActivityForNudge(nudge: BuddyNudge, currentUserId: string) {
  if (nudge.ack && isAfter(nudge.ack.updatedAt, nudge.createdAt)) {
    return {
      createdAt: nudge.ack.updatedAt,
      direction: nudge.toUser.id === currentUserId ? 'outgoing' as const : 'incoming' as const,
      sender: nudge.toUser,
      text: `回了：${ackCopies[nudge.ack.status]}`,
    };
  }

  return getMessageForNudge(nudge, currentUserId);
}

function formatThreadPreview(message: Pick<NudgeChatMessage, 'direction' | 'sender' | 'text'>): string {
  const prefix = message.direction === 'outgoing' ? '你' : getDisplayName(message.sender);
  return `${prefix}：${message.text}`;
}

function findMemberStatus(members: TeamMember[] | undefined, userId: string): TeamMember['status'] | null {
  return members?.find((member) => member.user.id === userId)?.status ?? null;
}

function isAfter(value: string, comparedValue: null | string): boolean {
  if (!comparedValue) {
    return true;
  }

  return new Date(value).getTime() > new Date(comparedValue).getTime();
}

function sortMessagesAsc(left: NudgeChatMessage, right: NudgeChatMessage) {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

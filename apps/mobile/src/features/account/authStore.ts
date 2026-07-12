import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AuthResponse, ProStatus, UpdateUserProfileRequest, UserProfile } from '@xiaotidu/contracts';

import { ApiClientError, apiClient, setApiSessionRefreshHandler, setApiUnauthorizedHandler } from '../../api/client';
import { queryClient } from '../../api/queryClient';
import { showToast } from '../../components/toast/AppToast';
import { clearSecureSession, loadSecureSession, saveSecureSession } from './sessionStorage';

export const mockUserIds = ['mock-user-a', 'mock-user-b', 'mock-user-c'] as const;
export type MockUserId = (typeof mockUserIds)[number];

type AuthState = {
  accessToken: null | string;
  accessTokenExpiresAt: null | string;
  error: null | string;
  hasHydrated: boolean;
  isLoading: boolean;
  lastUpdatedAt: null | string;
  loginWithApple: (identityToken: string, nickname?: string) => Promise<void>;
  loginWithMockApple: (mockUserId?: MockUserId) => Promise<void>;
  logout: () => Promise<void>;
  proStatus: ProStatus;
  refreshEntitlements: () => Promise<void>;
  refreshMe: () => Promise<void>;
  refreshSession: () => Promise<null | string>;
  refreshToken: null | string;
  restoreSecureSession: () => Promise<void>;
  selectedMockUserId: MockUserId;
  updateProfile: (input: UpdateUserProfileRequest) => Promise<boolean>;
  user: null | UserProfile;
};

const defaultProStatus: ProStatus = 'free';
let refreshPromise: Promise<null | string> | null = null;

function sessionState(response: AuthResponse) {
  return {
    accessToken: response.session.accessToken,
    accessTokenExpiresAt: response.session.accessTokenExpiresAt,
    refreshToken: response.session.refreshToken,
  };
}

async function persistResponseSession(response: AuthResponse) {
  await saveSecureSession(response.session);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      accessTokenExpiresAt: null,
      error: null,
      hasHydrated: false,
      isLoading: false,
      lastUpdatedAt: null,
      loginWithApple: async (identityToken, nickname) => {
        set({ error: null, isLoading: true });
        try {
          const response = await apiClient.loginWithApple({ identityToken, ...(nickname ? { nickname } : {}) });
          await persistResponseSession(response);
          queryClient.clear();
          set({
            ...sessionState(response),
            error: null,
            isLoading: false,
            lastUpdatedAt: new Date().toISOString(),
            proStatus: defaultProStatus,
            user: response.user,
          });
          await get().refreshEntitlements();
        } catch (error) {
          set({ error: notifyUserError(error), isLoading: false });
        }
      },
      loginWithMockApple: async (mockUserId = get().selectedMockUserId) => {
        const current = get();
        if (current.accessToken) {
          try {
            await apiClient.logout(current.accessToken, current.refreshToken);
          } catch {
            // 切换开发账号不能被旧会话撤销失败阻塞。
          }
        }
        set({ selectedMockUserId: mockUserId });
        await get().loginWithApple(mockUserId, `模拟搭子 ${mockUserId.slice(-1).toUpperCase()}`);
      },
      logout: async () => {
        const { accessToken, refreshToken } = get();
        set({ error: null, isLoading: true });
        try {
          if (accessToken) await apiClient.logout(accessToken, refreshToken);
        } catch {
          // 本地清理必须成功，服务端撤销失败由 session 过期兜底。
        } finally {
          await clearSecureSession();
          queryClient.clear();
          set({
            accessToken: null,
            accessTokenExpiresAt: null,
            error: null,
            isLoading: false,
            lastUpdatedAt: new Date().toISOString(),
            proStatus: defaultProStatus,
            refreshToken: null,
            user: null,
          });
        }
      },
      proStatus: defaultProStatus,
      refreshEntitlements: async () => {
        const token = get().accessToken;
        if (!token) {
          set({ proStatus: defaultProStatus });
          return;
        }
        try {
          const response = await apiClient.getEntitlements(token);
          set({ error: null, lastUpdatedAt: new Date().toISOString(), proStatus: response.proStatus });
        } catch (error) {
          handleAuthError(error, set);
        }
      },
      refreshMe: async () => {
        const token = get().accessToken;
        if (!token) return;
        set({ error: null, isLoading: true });
        try {
          const user = await apiClient.getCurrentUser(token);
          set({ error: null, isLoading: false, lastUpdatedAt: new Date().toISOString(), user });
        } catch (error) {
          handleAuthError(error, set);
          set({ isLoading: false });
        }
      },
      refreshSession: async () => {
        if (refreshPromise) return refreshPromise;
        const refreshToken = get().refreshToken;
        if (!refreshToken) return null;
        refreshPromise = (async () => {
          try {
            const response = await apiClient.refreshSession(refreshToken);
            await persistResponseSession(response);
            set({ ...sessionState(response), user: response.user });
            return response.session.accessToken;
          } catch {
            await clearSecureSession();
            set({
              accessToken: null,
              accessTokenExpiresAt: null,
              proStatus: defaultProStatus,
              refreshToken: null,
              user: null,
            });
            return null;
          } finally {
            refreshPromise = null;
          }
        })();
        return refreshPromise;
      },
      refreshToken: null,
      restoreSecureSession: async () => {
        const session = await loadSecureSession();
        if (!session) {
          set({ hasHydrated: true });
          return;
        }
        set({ ...session, hasHydrated: true });
        await Promise.all([get().refreshMe(), get().refreshEntitlements()]);
      },
      selectedMockUserId: 'mock-user-a',
      updateProfile: async (input) => {
        const token = get().accessToken;
        if (!token) {
          const message = '请先登录。';
          showToast(message, { type: 'error' });
          set({ error: message });
          return false;
        }
        set({ error: null, isLoading: true });
        try {
          const user = await apiClient.updateUserProfile(input, token);
          set({ error: null, isLoading: false, lastUpdatedAt: new Date().toISOString(), user });
          return true;
        } catch (error) {
          handleAuthError(error, set);
          set({ isLoading: false });
          return false;
        }
      },
      user: null,
    }),
    {
      name: 'xiaotidu-auth-profile-v2',
      onRehydrateStorage: () => (state) => {
        if (state) void state.restoreSecureSession();
      },
      partialize: (state) => ({
        lastUpdatedAt: state.lastUpdatedAt,
        proStatus: state.proStatus,
        selectedMockUserId: state.selectedMockUserId,
        user: state.user,
      }),
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function isProStatus(proStatus: ProStatus): boolean {
  return proStatus === 'pro_active' || proStatus === 'pro_grace_period';
}

function handleAuthError(error: unknown, set: (state: Partial<AuthState>) => void) {
  if (error instanceof ApiClientError && error.status === 401) return;
  set({ error: notifyUserError(error) });
}

export function notifyUserError(error: unknown): string {
  const message = toUserMessage(error);
  showToast(message, { type: 'error' });
  return message;
}

export function toUserMessage(error: unknown): string {
  if (error instanceof ApiClientError || error instanceof Error) return error.message;
  return '网络有点忙，稍后再试。';
}

setApiSessionRefreshHandler(() => useAuthStore.getState().refreshSession());
setApiUnauthorizedHandler(() => {
  void clearSecureSession();
  queryClient.clear();
  useAuthStore.setState({
    accessToken: null,
    accessTokenExpiresAt: null,
    error: '登录状态过期，请重新登录。',
    proStatus: defaultProStatus,
    refreshToken: null,
    user: null,
  });
});

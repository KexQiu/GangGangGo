import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ProStatus, UpdateUserProfileRequest, UserProfile } from '@xiaotidu/contracts';

import { ApiClientError, apiClient, setApiUnauthorizedHandler } from '../../api/client';
import { pickAndUploadAvatar } from './avatarUpload';

type AuthState = {
  accessToken: null | string;
  error: null | string;
  hasHydrated: boolean;
  isLoading: boolean;
  lastUpdatedAt: null | string;
  loginWithApple: (identityToken: string, nickname?: string) => Promise<void>;
  loginWithMockApple: () => Promise<void>;
  logout: () => Promise<void>;
  proStatus: ProStatus;
  refreshEntitlements: () => Promise<void>;
  refreshMe: () => Promise<void>;
  uploadAvatar: () => Promise<void>;
  updateProfile: (input: UpdateUserProfileRequest) => Promise<void>;
  user: null | UserProfile;
};

const defaultProStatus: ProStatus = 'free';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      error: null,
      hasHydrated: false,
      isLoading: false,
      lastUpdatedAt: null,
      loginWithApple: async (identityToken, nickname) => {
        set({ error: null, isLoading: true });

        try {
          const response = await apiClient.loginWithApple({
            identityToken,
            ...(nickname ? { nickname } : {}),
          });

          set({
            accessToken: response.token,
            error: null,
            isLoading: false,
            lastUpdatedAt: new Date().toISOString(),
            proStatus: defaultProStatus,
            user: response.user,
          });
          await get().refreshEntitlements();
        } catch (error) {
          set({
            error: toUserMessage(error),
            isLoading: false,
          });
        }
      },
      loginWithMockApple: async () => {
        await get().loginWithApple('mobile-mock-user', '小提督用户');
      },
      logout: async () => {
        const token = get().accessToken;

        set({ error: null, isLoading: true });

        try {
          if (token) {
            await apiClient.logout(token);
          }
        } catch {
          // 无状态 JWT 退出以客户端清 token 为准，服务端失败不阻塞本地退出。
        } finally {
          set({
            accessToken: null,
            error: null,
            isLoading: false,
            lastUpdatedAt: new Date().toISOString(),
            proStatus: defaultProStatus,
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
          set({
            error: null,
            lastUpdatedAt: new Date().toISOString(),
            proStatus: response.proStatus,
          });
        } catch (error) {
          handleAuthError(error, set);
        }
      },
      refreshMe: async () => {
        const token = get().accessToken;

        if (!token) {
          return;
        }

        set({ error: null, isLoading: true });

        try {
          const user = await apiClient.getCurrentUser(token);
          set({
            error: null,
            isLoading: false,
            lastUpdatedAt: new Date().toISOString(),
            user,
          });
        } catch (error) {
          handleAuthError(error, set);
          set({ isLoading: false });
        }
      },
      uploadAvatar: async () => {
        const token = get().accessToken;

        if (!token) {
          set({ error: '请先登录。' });
          return;
        }

        set({ error: null, isLoading: true });

        try {
          const avatarUrl = await pickAndUploadAvatar(token);

          if (!avatarUrl) {
            set({ isLoading: false });
            return;
          }

          const user = await apiClient.updateUserProfile({ avatarUrl }, token);
          set({
            error: null,
            isLoading: false,
            lastUpdatedAt: new Date().toISOString(),
            user,
          });
        } catch (error) {
          handleAuthError(error, set);
          set({ isLoading: false });
        }
      },
      updateProfile: async (input) => {
        const token = get().accessToken;

        if (!token) {
          set({ error: '请先登录。' });
          return;
        }

        set({ error: null, isLoading: true });

        try {
          const user = await apiClient.updateUserProfile(input, token);
          set({
            error: null,
            isLoading: false,
            lastUpdatedAt: new Date().toISOString(),
            user,
          });
        } catch (error) {
          handleAuthError(error, set);
          set({ isLoading: false });
        }
      },
      user: null,
    }),
    {
      name: 'xiaotidu-auth-session',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true;
        }
        const token = state?.accessToken;

        if (token) {
          void state.refreshMe().then(() => state.refreshEntitlements());
        }
      },
      partialize: (state) => ({
        accessToken: state.accessToken,
        lastUpdatedAt: state.lastUpdatedAt,
        proStatus: state.proStatus,
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
  if (error instanceof ApiClientError && error.status === 401) {
    set({
      accessToken: null,
      error: '登录状态过期，请重新登录。',
      proStatus: defaultProStatus,
      user: null,
    });
    return;
  }

  set({ error: toUserMessage(error) });
}

export function toUserMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return '这个功能需要小提督 Pro。';
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '网络有点忙，稍后再试。';
}

setApiUnauthorizedHandler(() => {
  useAuthStore.setState({
    accessToken: null,
    error: '登录状态过期，请重新登录。',
    proStatus: defaultProStatus,
    user: null,
  });
});

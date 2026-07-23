import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AuthResponse } from '@xiaotidu/contracts';

import { ApiClientError, authApi, setApiSessionRefreshHandler, setApiUnauthorizedHandler } from '../../api/client';
import { queryClient } from '../../api/queryClient';
import { showToast } from '../../components/toast/AppToast';
import { migrateAuthPreferences, type MockUserId } from './accountModel';
import { clearCloudQueryCache, resetCloudQueryCacheForUser } from './accountQueryCache';
import { refreshCurrentUserQuery, refreshEntitlementsQuery, seedCurrentUser } from './accountQueryService';
import { clearSecureSession, loadSecureSession, saveSecureSession } from './sessionStorage';
import { activateAnonymousLocalProfile, bindActiveLocalProfileToUser } from '../../storage/localDataProfile';
import { rebuildRecentDailySummaries } from '../data/dailyData';
import { useHabitStore } from '../habits/habitStore';
import { useToiletStore } from '../toilet/toiletStore';
import { useTrainingStore } from '../training/trainingStore';

export { isProStatus, mockUserIds } from './accountModel';
export type { MockUserId } from './accountModel';

type AuthState = {
  accessToken: null | string;
  accessTokenExpiresAt: null | string;
  error: null | string;
  hasHydrated: boolean;
  isLoading: boolean;
  loginWithApple: (identityToken: string, nickname?: string) => Promise<void>;
  loginWithMockApple: (mockUserId?: MockUserId) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<null | string>;
  refreshToken: null | string;
  restoreSecureSession: () => Promise<void>;
  selectedMockUserId: MockUserId;
};

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
      loginWithApple: async (identityToken, nickname) => {
        set({ error: null, isLoading: true });
        try {
          const response = await authApi.loginWithApple({ identityToken, ...(nickname ? { nickname } : {}) });
          await activateLocalUserProfile(response.user.id);
          await persistResponseSession(response);
          set({
            ...sessionState(response),
            error: null,
            isLoading: false,
          });
          resetCloudQueryCacheForUser(queryClient, response.user);
          try {
            await refreshEntitlementsQuery(response.session.accessToken);
          } catch (error) {
            handleAuthError(error, set);
          }
        } catch (error) {
          set({ error: notifyUserError(error), isLoading: false });
        }
      },
      loginWithMockApple: async (mockUserId = get().selectedMockUserId) => {
        const current = get();
        if (current.accessToken) {
          try {
            await authApi.logout(current.accessToken, current.refreshToken);
          } catch {
            // 切换开发账号不能被旧会话撤销失败阻塞。
          }
        }
        set({ selectedMockUserId: mockUserId });
        await get().loginWithApple(mockUserId, `模拟用户 ${mockUserId.slice(-1).toUpperCase()}`);
      },
      logout: async () => {
        const { accessToken, refreshToken } = get();
        set({ error: null, isLoading: true });
        try {
          if (accessToken) await authApi.logout(accessToken, refreshToken);
        } catch {
          // 本地清理必须成功，服务端撤销失败由 session 过期兜底。
        } finally {
          await clearSecureSession();
          clearCloudQueryCache(queryClient);
          set({
            accessToken: null,
            accessTokenExpiresAt: null,
            error: null,
            isLoading: true,
            refreshToken: null,
          });
          await activateLocalAnonymousProfile();
          set({ isLoading: false });
        }
      },
      refreshSession: async () => {
        if (refreshPromise) return refreshPromise;
        const refreshToken = get().refreshToken;
        if (!refreshToken) return null;
        refreshPromise = (async () => {
          try {
            const response = await authApi.refreshSession(refreshToken);
            await persistResponseSession(response);
            set(sessionState(response));
            seedCurrentUser(response.user);
            return response.session.accessToken;
          } catch {
            await clearSecureSession();
            clearCloudQueryCache(queryClient);
            set({
              accessToken: null,
              accessTokenExpiresAt: null,
              refreshToken: null,
            });
            await activateLocalAnonymousProfile();
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
          await activateLocalAnonymousProfile(false);
          set({ hasHydrated: true });
          return;
        }
        set(session);
        const [userResult] = await Promise.allSettled([
          refreshCurrentUserQuery(session.accessToken),
          refreshEntitlementsQuery(session.accessToken),
        ]);
        if (userResult.status === 'fulfilled') {
          await activateLocalUserProfile(userResult.value.id, false);
        } else if (!get().accessToken) {
          await activateLocalAnonymousProfile(false);
        }
        set({ hasHydrated: true });
      },
      selectedMockUserId: 'mock-user-a',
    }),
    {
      name: 'xiaotidu-auth-profile-v2',
      onRehydrateStorage: () => (state) => {
        if (state) void state.restoreSecureSession();
      },
      partialize: (state) => ({
        selectedMockUserId: state.selectedMockUserId,
      }),
      storage: createJSONStorage(() => AsyncStorage),
      migrate: migrateAuthPreferences,
      version: 3,
    },
  ),
);

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
  clearCloudQueryCache(queryClient);
  useAuthStore.setState({
    accessToken: null,
    accessTokenExpiresAt: null,
    error: '登录状态过期，请重新登录。',
    refreshToken: null,
  });
  void activateLocalAnonymousProfile();
});

async function activateLocalUserProfile(userId: string, reloadStores = true) {
  await bindActiveLocalProfileToUser(userId);
  if (reloadStores) await resetLocalHealthStores();
}

async function activateLocalAnonymousProfile(reloadStores = true) {
  await activateAnonymousLocalProfile();
  if (reloadStores) await resetLocalHealthStores();
}

async function resetLocalHealthStores() {
  useTrainingStore.setState({ hasHydrated: false, sessions: [] });
  useToiletStore.setState({ hasHydrated: false, sessions: [] });
  useHabitStore.setState({ checkIns: [], hasHydrated: false });
  await Promise.all([
    useTrainingStore.getState().hydrate(),
    useToiletStore.getState().hydrate(),
    useHabitStore.getState().hydrate(),
    rebuildRecentDailySummaries(),
  ]);
}

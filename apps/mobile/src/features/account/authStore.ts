import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AuthResponse } from '@xiaotidu/contracts';

import { ApiClientError, authApi, setApiSessionRefreshHandler, setApiUnauthorizedHandler } from '../../api/client';
import { queryClient } from '../../api/queryClient';
import { authSessionContext, SessionChangedError, type SessionSnapshot } from '../../api/sessionContext';
import { showToast } from '../../components/toast/AppToast';
import { clearCloudQueryCache, resetCloudQueryCacheForUser } from './accountQueryCache';
import { refreshCurrentUserQuery, refreshEntitlementsQuery, seedCurrentUser } from './accountQueryService';
import type { MockUserId } from './accountModel';
import { clearSecureSession, loadSecureSession, saveSecureSession } from './sessionStorage';
import {
  activateAnonymousLocalProfile,
  bindActiveLocalProfileToUser,
  restoreLocalProfile,
} from '../../storage/localDataProfile';
import { rebuildRecentDailySummaries } from '../data/dailyData';
import { useHabitStore } from '../habits/habitStore';
import { useToiletStore } from '../toilet/toiletStore';
import { useTrainingStore } from '../training/trainingStore';

export { mockUserIds } from './accountModel';
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
  refreshSession: (owner?: SessionSnapshot) => Promise<null | string>;
  refreshToken: null | string;
  restoreSecureSession: () => Promise<void>;
  selectedMockUserId: MockUserId;
};

const emptySession = { accessToken: null, accessTokenExpiresAt: null, refreshToken: null };
let refresh: { generation: number; promise: Promise<null | string> } | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...emptySession,
      error: null,
      hasHydrated: false,
      isLoading: false,
      loginWithApple: async (identityToken, nickname) => {
        const previous = get();
        const generation = beginTransition();
        revokeRemoteSession(previous);
        try {
          await authSessionContext.runExclusive(generation, clearSecureSession);
          const response = await authApi.loginWithApple({ identityToken, ...(nickname ? { nickname } : {}) });
          await authSessionContext.runExclusive(generation, async () => {
            const assertCurrent = () => authSessionContext.assertGeneration(generation);
            const profileId = await bindActiveLocalProfileToUser(response.user.id, assertCurrent);
            assertCurrent();
            await saveSecureSession({ ...response, profileId });
            assertCurrent();
            await resetLocalHealthStores();
            assertCurrent();
            publishSession(generation, profileId, response);
          });
          try {
            authSessionContext.assertGeneration(generation);
            await refreshEntitlementsQuery(response.session.accessToken);
          } catch (error) {
            if (authSessionContext.isGenerationCurrent(generation)) set({ error: notifyUserError(error) });
          }
        } catch (error) {
          if (!authSessionContext.isGenerationCurrent(generation)) return;
          await finishAnonymousSession(generation);
          if (authSessionContext.isGenerationCurrent(generation)) set({ error: notifyUserError(error) });
        }
      },
      loginWithMockApple: async (mockUserId = get().selectedMockUserId) => {
        set({ selectedMockUserId: mockUserId });
        await get().loginWithApple(mockUserId, `模拟用户 ${mockUserId.slice(-1).toUpperCase()}`);
      },
      logout: async () => {
        const previous = get();
        const generation = beginTransition();
        revokeRemoteSession(previous);
        await finishAnonymousSession(generation);
      },
      refreshSession: async (owner = authSessionContext.current() ?? undefined) => {
        if (!owner) return null;
        authSessionContext.assertCurrent(owner);
        if (refresh?.generation === owner.generation) return refresh.promise;
        const refreshToken = get().refreshToken;
        if (!refreshToken) return null;
        const pending = {
          generation: owner.generation,
          promise: (async () => {
            try {
              const response = await authApi.refreshSession(refreshToken);
              authSessionContext.assertCurrent(owner);
              if (response.user.id !== owner.userId) {
                throw new ApiClientError(0, 'invalid_response', '刷新会话的账号不匹配。');
              }
              await authSessionContext.runExclusive(owner.generation, async () => {
                await saveSecureSession({ ...response, profileId: owner.profileId });
                authSessionContext.assertCurrent(owner);
                authSessionContext.activate({ ...owner, accessToken: response.session.accessToken });
                set({ ...response.session, error: null });
                seedCurrentUser(response.user);
              });
              return response.session.accessToken;
            } catch (error) {
              // 旧账号的成功、失败均不能影响当前账号。
              authSessionContext.assertCurrent(owner);
              if (error instanceof ApiClientError && error.status === 401 && error.code === 'unauthorized') {
                await expireSession(owner);
                return null;
              }
              set({ error: toUserMessage(error) });
              throw error;
            }
          })(),
        };
        refresh = pending;
        pending.promise = pending.promise.finally(() => {
          if (refresh === pending) refresh = null;
        });
        return pending.promise;
      },
      restoreSecureSession: async () => {
        const generation = beginTransition();
        try {
          await authSessionContext.runExclusive(generation, async () => {
            const stored = await loadSecureSession();
            const assertCurrent = () => authSessionContext.assertGeneration(generation);
            assertCurrent();
            if (!stored) {
              await activateAnonymousLocalProfile();
              assertCurrent();
              authSessionContext.completeAnonymousTransition(generation);
              set({ hasHydrated: true, isLoading: false });
              return;
            }
            await restoreLocalProfile(stored.profileId, stored.user.id, assertCurrent);
            assertCurrent();
            publishSession(generation, stored.profileId, stored);
          });
          const owner = authSessionContext.current();
          if (!owner || owner.generation !== generation) return;
          // 已恢复可信的本地归属；网络暂不可用不影响离线访问。
          const results = await Promise.allSettled([
            refreshCurrentUserQuery(owner.accessToken),
            refreshEntitlementsQuery(owner.accessToken),
          ]);
          if (!authSessionContext.isGenerationCurrent(generation)) return;
          const failed = results.find((result) => result.status === 'rejected');
          if (failed?.status === 'rejected') set({ error: toUserMessage(failed.reason) });
        } catch (error) {
          if (authSessionContext.isGenerationCurrent(generation)) {
            set({ error: notifyUserError(error), hasHydrated: true, isLoading: false });
          }
        }
      },
      selectedMockUserId: 'mock-user-a',
    }),
    {
      name: 'xiaotidu-auth-preferences',
      onRehydrateStorage: () => (state) => {
        if (state)
          void Promise.resolve().then(() => {
            const current = useAuthStore.getState();
            if (!current.hasHydrated && !current.isLoading) return current.restoreSecureSession();
          });
      },
      partialize: (state) => ({ selectedMockUserId: state.selectedMockUserId }),
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

function beginTransition() {
  const generation = authSessionContext.beginTransition();
  clearCloudQueryCache(queryClient);
  useTrainingStore.getState().reset();
  useToiletStore.getState().reset();
  useHabitStore.getState().reset();
  useAuthStore.setState({ ...emptySession, error: null, isLoading: true });
  return generation;
}

function publishSession(generation: number, profileId: string, response: AuthResponse) {
  authSessionContext.activate({
    generation,
    profileId,
    userId: response.user.id,
    accessToken: response.session.accessToken,
  });
  resetCloudQueryCacheForUser(queryClient, response.user);
  useAuthStore.setState({ ...response.session, error: null, hasHydrated: true, isLoading: false });
}

async function finishAnonymousSession(generation: number) {
  try {
    await authSessionContext.runExclusive(generation, async () => {
      await clearSecureSession();
      authSessionContext.assertGeneration(generation);
      await activateAnonymousLocalProfile();
      await resetLocalHealthStores();
      authSessionContext.assertGeneration(generation);
      authSessionContext.completeAnonymousTransition(generation);
      useAuthStore.setState({ hasHydrated: true, isLoading: false });
    });
  } catch (error) {
    if (error instanceof SessionChangedError) return;
    if (authSessionContext.isGenerationCurrent(generation)) {
      useAuthStore.setState({ error: notifyUserError(error), isLoading: false });
    }
    throw error;
  }
}

function revokeRemoteSession(session: Pick<AuthState, 'accessToken' | 'refreshToken'>) {
  if (session.accessToken) {
    // 本地退出立即生效，不等待旧账号的网络请求。
    void authApi.logout(session.accessToken, session.refreshToken).catch(() => undefined);
  }
}

async function expireSession(owner: SessionSnapshot) {
  authSessionContext.assertCurrent(owner);
  const generation = beginTransition();
  useAuthStore.setState({ error: '登录状态过期，请重新登录。' });
  await finishAnonymousSession(generation);
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

setApiSessionRefreshHandler((owner) => useAuthStore.getState().refreshSession(owner));
setApiUnauthorizedHandler((owner) => {
  void expireSession(owner).catch(() => undefined);
});

async function resetLocalHealthStores() {
  useTrainingStore.getState().reset();
  useToiletStore.getState().reset();
  useHabitStore.getState().reset();
  await Promise.all([
    useTrainingStore.getState().hydrate(),
    useToiletStore.getState().hydrate(),
    useHabitStore.getState().hydrate(),
    rebuildRecentDailySummaries(),
  ]);
}

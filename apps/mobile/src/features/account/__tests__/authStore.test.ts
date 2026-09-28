import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResponse } from '@xiaotidu/contracts';
import { ApiClientError } from '../../../api/transport';
import { authSessionContext } from '../../../api/sessionContext';
import type { StoredSession } from '../sessionStorage';
import { useAuthStore } from '../authStore';
import {
  queueSessionRevocation,
  isSessionRevocationPending,
  flushPendingSessionRevocations,
} from '../sessionRevocation';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  clear: vi.fn(),
  bind: vi.fn(),
  anonymous: vi.fn(),
  restore: vi.fn(),
  currentUser: vi.fn(),
  entitlements: vi.fn(),
  seed: vi.fn(),
  resetCache: vi.fn(),
  clearCache: vi.fn(),
  hydrate: vi.fn(),
  reset: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('expo-sqlite/kv-store', () => ({
  default: {
    getItem: () => new Promise(() => undefined),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));
vi.mock('../../../api/client', async () => ({
  ApiClientError: (await import('../../../api/transport')).ApiClientError,
  authApi: { loginWithApple: mocks.login, refreshSession: mocks.refresh, logout: mocks.logout },
  setApiSessionRefreshHandler: vi.fn(),
  setApiUnauthorizedHandler: vi.fn(),
}));
vi.mock('../../../api/queryClient', () => ({ queryClient: {} }));
vi.mock('../../../components/toast/AppToast', () => ({ showToast: mocks.toast }));
vi.mock('../sessionStorage', () => ({
  loadSecureSession: mocks.load,
  saveSecureSession: mocks.save,
  clearSecureSession: mocks.clear,
}));
vi.mock('../sessionRevocation', () => ({
  queueSessionRevocation: vi.fn().mockResolvedValue(undefined),
  markLocalRevocationsCleared: async () => undefined,
  isSessionRevocationPending: vi.fn().mockResolvedValue(false),
  flushPendingSessionRevocations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../accountQueryCache', () => ({
  clearCloudQueryCache: mocks.clearCache,
  resetCloudQueryCacheForUser: mocks.resetCache,
}));
vi.mock('../accountQueryService', () => ({
  refreshCurrentUserQuery: mocks.currentUser,
  refreshEntitlementsQuery: mocks.entitlements,
  seedCurrentUser: mocks.seed,
}));
vi.mock('../../../storage/localDataProfile', () => ({
  bindActiveLocalProfileToUser: mocks.bind,
  activateAnonymousLocalProfile: mocks.anonymous,
  restoreLocalProfile: mocks.restore,
}));
vi.mock('../../data/dailyData', () => ({ rebuildRecentDailySummaries: vi.fn() }));
vi.mock('../../habits/habitStore', () => ({
  useHabitStore: { getState: () => ({ hydrate: mocks.hydrate, reset: mocks.reset }) },
}));
vi.mock('../../toilet/toiletStore', () => ({
  useToiletStore: { getState: () => ({ hydrate: mocks.hydrate, reset: mocks.reset }) },
}));
vi.mock('../../training/trainingStore', () => ({
  useTrainingStore: { getState: () => ({ hydrate: mocks.hydrate, reset: mocks.reset }) },
}));

let stored: StoredSession | null;
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const state = () => useAuthStore.getState();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(queueSessionRevocation).mockResolvedValue(undefined);
  vi.mocked(isSessionRevocationPending).mockResolvedValue(false);
  vi.mocked(flushPendingSessionRevocations).mockResolvedValue(undefined);
  authSessionContext.beginTransition();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    accessTokenExpiresAt: null,
    error: null,
    hasHydrated: false,
    isLoading: false,
  });
  stored = null;
  mocks.load.mockImplementation(async () => stored);
  mocks.save.mockImplementation(async (value) => {
    stored = value;
  });
  mocks.clear.mockImplementation(async () => {
    stored = null;
  });
  mocks.login.mockImplementation(async ({ identityToken }) => response(identityToken));
  mocks.logout.mockResolvedValue({ ok: true });
  mocks.bind.mockImplementation(async (userId, assertCurrent) => {
    assertCurrent();
    return `profile-${userId}`;
  });
  mocks.anonymous.mockResolvedValue('anonymous');
  mocks.restore.mockImplementation(async (_profile, _user, assertCurrent) => assertCurrent());
  mocks.entitlements.mockResolvedValue({});
});

describe('session ownership in auth store', () => {
  it('does not resurrect A when refresh succeeds after logout', async () => {
    await state().loginWithApple(A);
    const delayed = deferred<AuthResponse>();
    mocks.refresh.mockReturnValue(delayed.promise);
    const refreshing = state()
      .refreshSession()
      .catch((error) => error);
    await state().logout();
    delayed.resolve(response(A, 'rotated'));
    expect(await refreshing).toMatchObject({ code: 'session_changed' });
    expect(state().accessToken).toBeNull();
    expect(stored).toBeNull();
    expect(authSessionContext.current()).toBeNull();
    expect(mocks.seed).not.toHaveBeenCalled();
  });

  it.each(['success', '401', 'offline'])('ignores A refresh %s after B logs in', async (result) => {
    await state().loginWithApple(A);
    const delayed = deferred<AuthResponse>();
    mocks.refresh.mockReturnValue(delayed.promise);
    const refreshing = state()
      .refreshSession()
      .catch((error) => error);
    await state().loginWithApple(B);
    if (result === 'success') delayed.resolve(response(A, 'rotated'));
    else
      delayed.reject(
        new ApiClientError(result === '401' ? 401 : 0, result === '401' ? 'unauthorized' : 'network_error', result),
      );
    expect(await refreshing).toMatchObject({ code: 'session_changed' });
    expect(state().accessToken).toBe(response(B).session.accessToken);
    expect(stored?.user.id).toBe(B);
    expect(mocks.anonymous).not.toHaveBeenCalled();
    expect(mocks.seed).not.toHaveBeenCalled();
    expect(state().error).toBeNull();
  });

  it('ignores an older login that completes after a newer login', async () => {
    const delayed = deferred<AuthResponse>();
    mocks.login.mockReturnValueOnce(delayed.promise);
    const first = state().loginWithApple(A);
    await vi.waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
    await state().loginWithApple(B);
    delayed.resolve(response(A));
    await first;
    expect(stored?.user.id).toBe(B);
    expect(mocks.bind).toHaveBeenCalledTimes(1);
    expect(authSessionContext.current()?.userId).toBe(B);
  });

  it('orders an in-flight secure write before logout cleanup', async () => {
    await state().loginWithApple(A);
    const saving = deferred<void>();
    mocks.save.mockImplementationOnce(async (value) => {
      await saving.promise;
      stored = value;
    });
    mocks.refresh.mockResolvedValue(response(A, 'rotated'));
    const refreshing = state()
      .refreshSession()
      .catch((error) => error);
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    const logout = state().logout();
    expect(state().accessToken).toBeNull();
    saving.resolve();
    await Promise.all([refreshing, logout]);
    expect(stored).toBeNull();
    expect(mocks.seed).not.toHaveBeenCalled();
  });

  it('does not let an old refresh finalizer clear the new single flight', async () => {
    await state().loginWithApple(A);
    const old = deferred<AuthResponse>();
    const current = deferred<AuthResponse>();
    mocks.refresh.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const oldRefresh = state()
      .refreshSession()
      .catch((error) => error);
    await state().loginWithApple(B);
    const currentRefresh = state().refreshSession();
    old.resolve(response(A, 'rotated'));
    await oldRefresh;
    const joined = state().refreshSession();
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    current.resolve(response(B, 'rotated'));
    await expect(Promise.all([currentRefresh, joined])).resolves.toEqual([`${B}-rotated`, `${B}-rotated`]);
  });

  it.each([
    [0, 'network_error'],
    [0, 'timeout'],
    [503, 'internal_error'],
    [200, 'invalid_response'],
    [401, 'invalid_response'],
  ])('retains the session after temporary failure %s/%s', async (status, code) => {
    await state().loginWithApple(A);
    const original = stored;
    const failure = new ApiClientError(Number(status), String(code), '暂时不可用');
    mocks.refresh.mockRejectedValue(failure);
    await expect(state().refreshSession()).rejects.toBe(failure);
    expect(stored).toBe(original);
    expect(authSessionContext.current()?.userId).toBe(A);
    expect(state().error).toBe('暂时不可用');
    expect(mocks.anonymous).not.toHaveBeenCalled();
    mocks.refresh.mockResolvedValue(response(A, 'retry'));
    await expect(state().refreshSession()).resolves.toBe(`${A}-retry`);
    expect(state().error).toBeNull();
  });

  it('clears only a confirmed invalid credential', async () => {
    await state().loginWithApple(A);
    mocks.refresh.mockRejectedValue(new ApiClientError(401, 'unauthorized', 'expired'));
    await expect(state().refreshSession()).resolves.toBeNull();
    expect(state().accessToken).toBeNull();
    expect(stored).toBeNull();
    expect(mocks.anonymous).toHaveBeenCalledOnce();
  });

  it('rejects a refresh response belonging to another user', async () => {
    await state().loginWithApple(A);
    mocks.refresh.mockResolvedValue(response(B));
    await expect(state().refreshSession()).rejects.toMatchObject({ code: 'invalid_response' });
    expect(stored?.user.id).toBe(A);
  });

  it('restores the known local owner without a network connection', async () => {
    stored = { ...response(A), profileId: `profile-${A}` };
    mocks.currentUser.mockRejectedValue(new ApiClientError(0, 'network_error', 'offline'));
    mocks.entitlements.mockRejectedValue(new ApiClientError(0, 'network_error', 'offline'));
    await state().restoreSecureSession();
    expect(mocks.restore).toHaveBeenCalledWith(`profile-${A}`, A, expect.any(Function));
    expect(authSessionContext.current()?.userId).toBe(A);
    expect(state()).toMatchObject({
      accessToken: `${A}-initial`,
      hasHydrated: true,
      isLoading: false,
      error: 'offline',
    });
    expect(stored?.user.id).toBe(A);
    expect(mocks.anonymous).not.toHaveBeenCalled();
  });

  it('does not publish a delayed restore after a new login starts', async () => {
    const reading = deferred<StoredSession>();
    mocks.load.mockReturnValueOnce(reading.promise);
    const restoring = state().restoreSecureSession();
    await vi.waitFor(() => expect(mocks.load).toHaveBeenCalledOnce());
    const login = state().loginWithApple(B);
    reading.resolve({ ...response(A), profileId: `profile-${A}` });
    await Promise.all([restoring, login]);
    expect(stored?.user.id).toBe(B);
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it('finishes local logout even while remote revocation is pending', async () => {
    await state().loginWithApple(A);
    vi.mocked(flushPendingSessionRevocations).mockReturnValue(new Promise(() => undefined));
    await state().logout();
    expect(queueSessionRevocation).toHaveBeenCalledWith(`${A}-refresh-initial`, A);
    expect(state()).toMatchObject({ accessToken: null, isLoading: false });
    expect(stored).toBeNull();
  });

  it('does not erase the secure session if durable logout compensation fails', async () => {
    await state().loginWithApple(A);
    vi.mocked(queueSessionRevocation).mockRejectedValueOnce(new Error('secure storage failed'));
    await expect(state().logout()).rejects.toThrow('secure storage failed');
    expect(stored?.user.id).toBe(A);
    expect(state().error).toBe('secure storage failed');
  });

  it('finishes an interrupted logout before restoring a saved session', async () => {
    stored = { ...response(A), profileId: `profile-${A}` };
    vi.mocked(isSessionRevocationPending).mockResolvedValue(true);
    await state().restoreSecureSession();
    expect(stored).toBeNull();
    expect(state().accessToken).toBeNull();
    expect(mocks.restore).not.toHaveBeenCalled();
  });
});

function response(userId: string, suffix = 'initial'): AuthResponse {
  return {
    user: { id: userId, avatarUrl: null, nickname: userId, timezone: 'Asia/Shanghai' },
    session: {
      accessToken: `${userId}-${suffix}`,
      refreshToken: `${userId}-refresh-${suffix}`,
      accessTokenExpiresAt: '2026-09-28T12:00:00.000Z',
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

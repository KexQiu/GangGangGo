import { afterEach, describe, expect, it, vi } from 'vitest';

import { SyncCoordinator, type SyncAppState, type SyncCoordinatorDependencies } from '../syncCoordinatorCore';

afterEach(() => {
  vi.useRealTimers();
});

describe('SyncCoordinator', () => {
  it('does not mark skipped tasks as successful or advance their last success time', async () => {
    vi.useFakeTimers();
    const harness = createHarness({ accessToken: 'A' });
    harness.syncData.mockResolvedValueOnce({ outcome: 'skipped', reason: 'no owner' });
    const coordinator = new SyncCoordinator(harness.dependencies);
    coordinator.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(coordinator.getTaskStatuses().data).toMatchObject({
      phase: 'skipped',
      lastSucceededAt: null,
      skipReason: 'no owner',
    });
    coordinator.retryTask('data');
    await vi.advanceTimersByTimeAsync(0);
    const succeededAt = coordinator.getTaskStatuses().data.lastSucceededAt;
    expect(succeededAt).not.toBeNull();
    harness.syncData.mockRejectedValueOnce(new Error('offline'));
    coordinator.retryTask('data');
    await vi.advanceTimersByTimeAsync(0);
    expect(coordinator.getTaskStatuses().data).toMatchObject({ phase: 'error', lastSucceededAt: succeededAt });
    coordinator.stop();
  });

  it.each(['success', 'error'] as const)(
    'ignores late account A %s and lets B synchronize without waiting for A',
    async (outcome) => {
      vi.useFakeTimers();
      const pending = deferred<{ outcome: 'success' }>();
      const harness = createHarness({ accessToken: 'A' });
      harness.syncData.mockReturnValueOnce(pending.promise);
      const coordinator = new SyncCoordinator(harness.dependencies);
      coordinator.start();
      await vi.advanceTimersByTimeAsync(0);
      harness.changeAuth('B', 2);
      expect(coordinator.getTaskStatuses().data.phase).toBe('idle');
      await vi.advanceTimersByTimeAsync(0);
      expect(harness.syncData).toHaveBeenCalledTimes(2);
      const statusB = coordinator.getTaskStatuses();
      if (outcome === 'success') pending.resolve({ outcome: 'success' });
      else pending.reject(new Error('A offline'));
      await vi.advanceTimersByTimeAsync(0);
      expect(coordinator.getTaskStatuses()).toEqual(statusB);
      coordinator.stop();
    },
  );

  it('clears success on logout and does not synchronize health records anonymously', async () => {
    vi.useFakeTimers();
    const harness = createHarness({ accessToken: 'A' });
    const coordinator = new SyncCoordinator(harness.dependencies);
    coordinator.start();
    await vi.advanceTimersByTimeAsync(0);
    harness.changeAuth(null, null);
    expect(coordinator.getTaskStatuses().data).toMatchObject({ phase: 'idle', lastSucceededAt: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.syncData).toHaveBeenCalledOnce();
    coordinator.stop();
  });

  it('keeps the same owner result during token rotation', async () => {
    vi.useFakeTimers();
    const pending = deferred<{ outcome: 'success' }>();
    const harness = createHarness({ accessToken: 'A' });
    harness.syncData.mockReturnValueOnce(pending.promise);
    const coordinator = new SyncCoordinator(harness.dependencies);
    coordinator.start();
    await vi.advanceTimersByTimeAsync(0);
    harness.changeAuth('A-rotated', 1);
    expect(coordinator.getTaskStatuses().data.phase).toBe('running');
    pending.resolve({ outcome: 'success' });
    await vi.advanceTimersByTimeAsync(0);
    expect(coordinator.getTaskStatuses().data.phase).toBe('success');
    coordinator.stop();
  });

  it('ignores an old run after stop and restart', async () => {
    vi.useFakeTimers();
    const pending = deferred<{ outcome: 'success' }>();
    const harness = createHarness({ accessToken: 'A' });
    harness.syncData.mockReturnValueOnce(pending.promise);
    const coordinator = new SyncCoordinator(harness.dependencies);
    coordinator.start();
    await vi.advanceTimersByTimeAsync(0);
    coordinator.stop();
    coordinator.start();
    await vi.advanceTimersByTimeAsync(0);
    const newStatus = coordinator.getTaskStatuses();
    pending.reject(new Error('old failure'));
    await vi.advanceTimersByTimeAsync(0);
    expect(coordinator.getTaskStatuses()).toEqual(newStatus);
    coordinator.stop();
  });

  it('debounces local changes into one synchronization run', async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const coordinator = new SyncCoordinator(harness.dependencies);
    coordinator.start();
    await vi.advanceTimersByTimeAsync(0);
    harness.syncWatch.mockClear();

    harness.emitLocalChange();
    harness.emitLocalChange();
    harness.emitLocalChange();
    await vi.advanceTimersByTimeAsync(749);
    expect(harness.syncWatch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(harness.syncWatch).toHaveBeenCalledTimes(1);
    expect(harness.syncWatch.mock.calls[0]?.[1]).toBe('local_changed');
    coordinator.stop();
  });

  it('allows at most one running synchronization and one trailing run', async () => {
    vi.useFakeTimers();
    let releaseFirstRun: (() => void) | undefined;
    const firstRun = new Promise<{ outcome: 'success' }>((resolve) => {
      releaseFirstRun = () => resolve({ outcome: 'success' });
    });
    const harness = createHarness({
      syncWatch: vi
        .fn()
        .mockImplementationOnce(() => firstRun)
        .mockResolvedValue({ outcome: 'success' }),
    });
    const coordinator = new SyncCoordinator(harness.dependencies);
    coordinator.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.syncWatch).toHaveBeenCalledTimes(1);

    harness.emitLocalChange();
    harness.emitLocalChange();
    harness.emitLocalChange();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(harness.syncWatch).toHaveBeenCalledTimes(1);

    releaseFirstRun?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(750);
    expect(harness.syncWatch).toHaveBeenCalledTimes(2);
    coordinator.stop();
  });

  it('runs authenticated synchronization tasks independently', async () => {
    vi.useFakeTimers();
    const harness = createHarness({ accessToken: 'access-token' });
    harness.refreshEntitlements.mockRejectedValueOnce(new Error('entitlements unavailable'));
    const coordinator = new SyncCoordinator(harness.dependencies);
    coordinator.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(harness.refreshEntitlements).toHaveBeenCalledTimes(1);
    expect(harness.syncWatch).toHaveBeenCalledTimes(1);
    expect(harness.syncData).toHaveBeenCalledTimes(1);
    expect(harness.registerPushToken).toHaveBeenCalledTimes(1);
    expect(coordinator.getTaskStatuses().entitlements).toMatchObject({
      lastError: 'entitlements unavailable',
      phase: 'error',
    });
    expect(coordinator.getTaskStatuses().data.phase).toBe('success');
    coordinator.stop();
  });

  it('retries only the selected synchronization task', async () => {
    vi.useFakeTimers();
    const harness = createHarness({ accessToken: 'access-token' });
    harness.syncData.mockRejectedValueOnce(new Error('data unavailable'));
    const coordinator = new SyncCoordinator(harness.dependencies);
    coordinator.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(coordinator.getTaskStatuses().data.phase).toBe('error');

    harness.refreshEntitlements.mockClear();
    harness.registerPushToken.mockClear();
    harness.syncData.mockClear();
    harness.syncWatch.mockClear();
    coordinator.retryTask('data');
    await vi.advanceTimersByTimeAsync(0);

    expect(harness.syncData).toHaveBeenCalledTimes(1);
    expect(harness.refreshEntitlements).not.toHaveBeenCalled();
    expect(harness.registerPushToken).not.toHaveBeenCalled();
    expect(harness.syncWatch).not.toHaveBeenCalled();
    expect(coordinator.getTaskStatuses().data).toMatchObject({ lastError: null, phase: 'success' });
    coordinator.stop();
  });

  it('waits in the background and synchronizes immediately on foreground', async () => {
    vi.useFakeTimers();
    const harness = createHarness({ appState: 'background' });
    const coordinator = new SyncCoordinator(harness.dependencies);
    coordinator.start();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(harness.syncWatch).not.toHaveBeenCalled();

    harness.emitAppState('active');
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.syncWatch).toHaveBeenCalledTimes(1);
    expect(harness.syncWatch.mock.calls[0]?.[1]).toBe('app_boot,app_foreground');
    coordinator.stop();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function createHarness(
  options: {
    accessToken?: string | null;
    appState?: SyncAppState;
    syncWatch?: SyncCoordinatorDependencies['syncWatch'];
  } = {},
) {
  let appState = options.appState ?? 'active';
  const appStateListeners = new Set<(state: SyncAppState) => void>();
  const authListeners = new Set<(change: { accessTokenChanged: boolean; entitlementsChanged: boolean }) => void>();
  const localListeners = new Set<() => void>();
  let accessToken = options.accessToken ?? null;
  let sessionKey: number | null = accessToken ? 1 : null;
  const refreshEntitlements = vi.fn().mockResolvedValue({ outcome: 'success' });
  const registerPushToken = vi.fn().mockResolvedValue({ outcome: 'success' });
  const syncData = vi.fn().mockResolvedValue({ outcome: 'success' });
  const syncWatch = vi.fn(options.syncWatch ?? (async () => ({ outcome: 'success' as const })));

  const dependencies: SyncCoordinatorDependencies = {
    getAppState: () => appState,
    getAuth: () => ({ accessToken, sessionKey, refreshEntitlements }),
    registerPushToken,
    subscribeAppState: (listener) => {
      appStateListeners.add(listener);
      return () => appStateListeners.delete(listener);
    },
    subscribeAuthChanges: (listener) => {
      authListeners.add(listener);
      return () => authListeners.delete(listener);
    },
    subscribeLocalChanges: (listener) => {
      localListeners.add(listener);
      return () => localListeners.delete(listener);
    },
    syncData,
    syncWatch,
  };

  return {
    dependencies,
    changeAuth(nextToken: string | null, nextKey: number | null) {
      accessToken = nextToken;
      sessionKey = nextKey;
      for (const listener of authListeners) listener({ accessTokenChanged: true, entitlementsChanged: false });
    },
    emitAppState(nextState: SyncAppState) {
      appState = nextState;
      for (const listener of appStateListeners) listener(nextState);
    },
    emitLocalChange() {
      for (const listener of localListeners) listener();
    },
    refreshEntitlements,
    registerPushToken,
    syncData,
    syncWatch,
  };
}

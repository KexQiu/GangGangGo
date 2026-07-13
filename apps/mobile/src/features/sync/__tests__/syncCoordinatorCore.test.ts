import { afterEach, describe, expect, it, vi } from 'vitest';

import { SyncCoordinator, type SyncAppState, type SyncCoordinatorDependencies } from '../syncCoordinatorCore';

afterEach(() => {
  vi.useRealTimers();
});

describe('SyncCoordinator', () => {
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
    const firstRun = new Promise<void>((resolve) => {
      releaseFirstRun = resolve;
    });
    const harness = createHarness({
      syncWatch: vi
        .fn()
        .mockImplementationOnce(() => firstRun)
        .mockResolvedValue(undefined),
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
    harness.syncShareSnapshot.mockRejectedValueOnce(new Error('share unavailable'));
    const coordinator = new SyncCoordinator(harness.dependencies);
    coordinator.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(harness.refreshEntitlements).toHaveBeenCalledTimes(1);
    expect(harness.syncWatch).toHaveBeenCalledTimes(1);
    expect(harness.syncShareSnapshot).toHaveBeenCalledTimes(1);
    expect(harness.syncReports).toHaveBeenCalledTimes(1);
    expect(harness.registerPushToken).toHaveBeenCalledTimes(1);
    expect(coordinator.getTaskStatuses().entitlements).toMatchObject({
      lastError: 'entitlements unavailable',
      phase: 'error',
    });
    expect(coordinator.getTaskStatuses().shareSnapshot).toMatchObject({
      lastError: 'share unavailable',
      phase: 'error',
    });
    expect(coordinator.getTaskStatuses().reports.phase).toBe('success');
    coordinator.stop();
  });

  it('retries only the selected synchronization task', async () => {
    vi.useFakeTimers();
    const harness = createHarness({ accessToken: 'access-token' });
    harness.syncReports.mockRejectedValueOnce(new Error('reports unavailable'));
    const coordinator = new SyncCoordinator(harness.dependencies);
    coordinator.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(coordinator.getTaskStatuses().reports.phase).toBe('error');

    harness.refreshEntitlements.mockClear();
    harness.registerPushToken.mockClear();
    harness.syncReports.mockClear();
    harness.syncShareSnapshot.mockClear();
    harness.syncWatch.mockClear();
    coordinator.retryTask('reports');
    await vi.advanceTimersByTimeAsync(0);

    expect(harness.syncReports).toHaveBeenCalledTimes(1);
    expect(harness.refreshEntitlements).not.toHaveBeenCalled();
    expect(harness.registerPushToken).not.toHaveBeenCalled();
    expect(harness.syncShareSnapshot).not.toHaveBeenCalled();
    expect(harness.syncWatch).not.toHaveBeenCalled();
    expect(coordinator.getTaskStatuses().reports).toMatchObject({ lastError: null, phase: 'success' });
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

function createHarness(
  options: {
    accessToken?: string | null;
    appState?: SyncAppState;
    syncWatch?: SyncCoordinatorDependencies['syncWatch'];
  } = {},
) {
  let appState = options.appState ?? 'active';
  const appStateListeners = new Set<(state: SyncAppState) => void>();
  const authListeners = new Set<(change: { accessTokenChanged: boolean; proStatusChanged: boolean }) => void>();
  const localListeners = new Set<() => void>();
  const refreshEntitlements = vi.fn().mockResolvedValue(undefined);
  const registerPushToken = vi.fn().mockResolvedValue(undefined);
  const syncReports = vi.fn().mockResolvedValue(undefined);
  const syncShareSnapshot = vi.fn().mockResolvedValue(undefined);
  const syncWatch = vi.fn(options.syncWatch ?? (async () => undefined));

  const dependencies: SyncCoordinatorDependencies = {
    getAppState: () => appState,
    getAuth: () => ({ accessToken: options.accessToken ?? null, refreshEntitlements }),
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
    syncReports,
    syncShareSnapshot,
    syncWatch,
  };

  return {
    dependencies,
    emitAppState(nextState: SyncAppState) {
      appState = nextState;
      for (const listener of appStateListeners) listener(nextState);
    },
    emitLocalChange() {
      for (const listener of localListeners) listener();
    },
    refreshEntitlements,
    registerPushToken,
    syncReports,
    syncShareSnapshot,
    syncWatch,
  };
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActiveToiletTimerSession } from '../toiletTimerSessionStore';
import {
  recoverToiletLiveActivityState,
  type ToiletLiveActivityRecoveryDependencies,
  type ToiletLiveActivityRecoveryState,
} from '../toiletLiveActivityRecovery';

describe('Live Activity launch recovery', () => {
  let state: ToiletLiveActivityRecoveryState;

  beforeEach(() => {
    state = {
      isEnabled: true,
      session: makeSession(),
    };
  });

  it('waits for persisted state before reconciling an active timer', async () => {
    let finishHydration: (() => void) | undefined;
    const hydration = new Promise<void>((resolve) => {
      finishHydration = resolve;
    });
    const harness = createHarness(() => state, { waitUntilHydrated: () => hydration });

    const recovery = recoverToiletLiveActivityState(harness.dependencies);
    await Promise.resolve();
    expect(harness.reconcile).not.toHaveBeenCalled();

    finishHydration?.();
    await recovery;

    expect(harness.reconcile).toHaveBeenCalledWith(state.session, 120);
    expect(state.session?.liveActivityId).toBe('recovered-activity');
  });

  it('ends orphan activities when no timer should be displayed', async () => {
    state = { isEnabled: true, session: null };
    const harness = createHarness(() => state);

    await recoverToiletLiveActivityState(harness.dependencies);

    expect(harness.endAll).toHaveBeenCalledTimes(1);
    expect(harness.reconcile).not.toHaveBeenCalled();
  });

  it('reconciles a timer started while orphan activities are being removed', async () => {
    const startedSession = makeSession({ startedAt: '2026-07-14T02:00:00.000Z' });
    state = { isEnabled: true, session: null };
    const harness = createHarness(() => state);
    harness.endAll.mockImplementationOnce(async () => {
      state = { isEnabled: true, session: startedSession };
    });

    await recoverToiletLiveActivityState(harness.dependencies);

    expect(harness.endAll).toHaveBeenCalledTimes(1);
    expect(harness.reconcile).toHaveBeenCalledWith(startedSession, 120);
    expect(state.session?.liveActivityId).toBe('recovered-activity');
  });

  it('ends activities and clears a stale id when the setting is disabled', async () => {
    state = {
      isEnabled: false,
      session: makeSession({ liveActivityId: 'stale-activity' }),
    };
    const harness = createHarness(() => state);

    await recoverToiletLiveActivityState(harness.dependencies);

    expect(harness.endAll).toHaveBeenCalledTimes(1);
    expect(state.session?.liveActivityId).toBeNull();
  });

  it('reconciles the trailing session when state changes during native recovery', async () => {
    const firstSession = makeSession({ startedAt: '2026-07-14T00:00:00.000Z' });
    const trailingSession = makeSession({ startedAt: '2026-07-14T01:00:00.000Z' });
    state = { isEnabled: true, session: firstSession };
    const harness = createHarness(() => state);
    harness.reconcile
      .mockImplementationOnce(async () => {
        state = { isEnabled: true, session: trailingSession };
        return 'superseded-activity';
      })
      .mockResolvedValueOnce('trailing-activity');

    await recoverToiletLiveActivityState(harness.dependencies);

    expect(harness.reconcile).toHaveBeenCalledTimes(2);
    expect(harness.reconcile.mock.calls[1]?.[0]).toBe(trailingSession);
    expect(state.session?.liveActivityId).toBe('trailing-activity');
  });

  it('keeps the persisted id when native reconciliation fails transiently', async () => {
    state = {
      isEnabled: true,
      session: makeSession({ liveActivityId: 'persisted-activity' }),
    };
    const harness = createHarness(() => state);
    harness.reconcile.mockResolvedValueOnce(undefined);

    await recoverToiletLiveActivityState(harness.dependencies);

    expect(state.session?.liveActivityId).toBe('persisted-activity');
  });

  it('clears a stale id when native reconciliation finds no activity support', async () => {
    state = {
      isEnabled: true,
      session: makeSession({ liveActivityId: 'stale-activity' }),
    };
    const harness = createHarness(() => state);
    harness.reconcile.mockResolvedValueOnce(null);

    await recoverToiletLiveActivityState(harness.dependencies);

    expect(state.session?.liveActivityId).toBeNull();
  });
});

function createHarness(
  readState: () => ToiletLiveActivityRecoveryState,
  overrides: Partial<ToiletLiveActivityRecoveryDependencies> = {},
) {
  const endAll = vi.fn().mockResolvedValue(undefined);
  const reconcile = vi.fn().mockResolvedValue('recovered-activity');
  const dependencies: ToiletLiveActivityRecoveryDependencies = {
    endAll,
    getElapsedSeconds: (session) => session.baseElapsedSeconds,
    readState,
    reconcile,
    setActivityId: (activityId) => {
      const current = readState().session;
      if (current) current.liveActivityId = activityId;
    },
    waitUntilHydrated: async () => undefined,
    ...overrides,
  };

  return { dependencies, endAll, reconcile };
}

function makeSession(overrides: Partial<ActiveToiletTimerSession> = {}): ActiveToiletTimerSession {
  return {
    baseElapsedSeconds: 120,
    isPaused: false,
    lastResumedAt: '2026-07-14T00:00:00.000Z',
    liveActivityId: null,
    startedAt: '2026-07-14T00:00:00.000Z',
    ...overrides,
  };
}

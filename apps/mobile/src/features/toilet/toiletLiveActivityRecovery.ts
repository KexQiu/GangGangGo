import type { ActiveToiletTimerSession } from './toiletTimerSessionStore';

export type ToiletLiveActivityRecoveryState = {
  isEnabled: boolean;
  session: ActiveToiletTimerSession | null;
};

export type ToiletLiveActivityRecoveryDependencies = {
  endAll: () => Promise<void>;
  getElapsedSeconds: (session: ActiveToiletTimerSession) => number;
  readState: () => ToiletLiveActivityRecoveryState;
  reconcile: (session: ActiveToiletTimerSession, elapsedSeconds: number) => Promise<string | null | undefined>;
  setActivityId: (activityId: string | null) => void;
  waitUntilHydrated: () => Promise<void>;
};

export async function recoverToiletLiveActivityState(
  dependencies: ToiletLiveActivityRecoveryDependencies,
): Promise<void> {
  await dependencies.waitUntilHydrated();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const state = dependencies.readState();
    const recoveryIdentity = getRecoveryIdentity(state);

    if (!state.isEnabled || !state.session) {
      await dependencies.endAll();
      if (recoveryIdentity !== getRecoveryIdentity(dependencies.readState())) continue;
      if (state.session?.liveActivityId) dependencies.setActivityId(null);
      return;
    }

    const elapsedSeconds = dependencies.getElapsedSeconds(state.session);
    const reconciledActivityId = await dependencies.reconcile(state.session, elapsedSeconds);
    if (recoveryIdentity !== getRecoveryIdentity(dependencies.readState())) continue;
    if (reconciledActivityId === undefined) return;
    if (reconciledActivityId !== state.session.liveActivityId) {
      dependencies.setActivityId(reconciledActivityId);
    }
    return;
  }
}

function getRecoveryIdentity(state: ToiletLiveActivityRecoveryState): string {
  const { session } = state;
  return JSON.stringify([
    state.isEnabled,
    session?.startedAt ?? null,
    session?.baseElapsedSeconds ?? null,
    session?.isPaused ?? null,
    session?.lastResumedAt ?? null,
    session?.liveActivityId ?? null,
  ]);
}

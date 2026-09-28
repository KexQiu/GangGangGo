import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistWatchTimerAction, useToiletTimerSessionStore } from '../toiletTimerSessionStore';

const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }));
vi.mock('expo-sqlite/kv-store', () => ({ default: storage }));
const session = {
  id: 'timer-A',
  baseElapsedSeconds: 0,
  isPaused: false,
  lastResumedAt: '2026-09-28T00:00:00Z',
  liveActivityId: null,
  startedAt: '2026-09-28T00:00:00Z',
};
beforeEach(() => {
  storage.setItem.mockReset().mockResolvedValue(undefined);
  useToiletTimerSessionStore.setState({ session });
});

describe('Watch timer persistence', () => {
  it('waits for storage and restores the previous session on failure', async () => {
    let reject!: (error: Error) => void;
    storage.setItem.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    let settled = false;
    const saving = persistWatchTimerAction(session.id, 'pause', 120);
    const assertion = expect(saving).rejects.toThrow('disk full');
    void saving.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await Promise.resolve();
    expect(settled).toBe(false);
    reject(new Error('disk full'));
    await assertion;
    expect(useToiletTimerSessionStore.getState().session).toEqual(session);
  });

  it('keeps the resume time stable when the same action is retried', async () => {
    await persistWatchTimerAction(session.id, 'pause', 120);
    await persistWatchTimerAction(session.id, 'resume', 120);
    const resumed = useToiletTimerSessionStore.getState().session;
    await persistWatchTimerAction(session.id, 'resume', 120);
    expect(useToiletTimerSessionStore.getState().session).toBe(resumed);
    expect(resumed?.baseElapsedSeconds).toBe(120);
  });

  it('never clears another timer or restores the old timer over it on failure', async () => {
    let reject!: (error: Error) => void;
    storage.setItem.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const saving = persistWatchTimerAction(session.id, 'finish', 120);
    const assertion = expect(saving).rejects.toThrow('disk full');
    const replacement = { ...session, id: 'timer-B' };
    useToiletTimerSessionStore.setState({ session: replacement });
    reject(new Error('disk full'));
    await assertion;
    await persistWatchTimerAction(session.id, 'finish', 120);
    expect(useToiletTimerSessionStore.getState().session).toEqual(replacement);
  });
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TrainingClock } from '../trainingClock';
import { startTrainingClockLifecycle } from '../trainingClockLifecycle';

const native = vi.hoisted(() => ({
  listener: null as null | ((state: string) => void),
  remove: vi.fn(),
  app: { currentState: 'active' },
}));
vi.mock('react-native', () => ({
  AppState: Object.assign(native.app, {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      native.listener = listener;
      return { remove: native.remove };
    },
  }),
}));
beforeEach(() => {
  vi.useFakeTimers();
  native.app.currentState = 'active';
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it('pauses on inactive/background, ignores the time away and never auto-resumes', () => {
  let now = 0;
  const clock = new TrainingClock(
    'beginner',
    null,
    () => {},
    () => now,
  );
  clock.confirmPrompt();
  const stop = startTrainingClockLifecycle(clock, vi.fn());
  now = 2_700;
  native.listener?.('inactive');
  native.app.currentState = 'background';
  native.listener?.('background');
  now = 300_000;
  vi.advanceTimersByTime(300_000);
  native.app.currentState = 'active';
  native.listener?.('active');
  expect(clock.paused).toBe(true);
  expect(clock.elapsedSeconds).toBe(0);
  clock.resume();
  clock.confirmPrompt();
  now += 300;
  expect(clock.elapsedSeconds).toBe(0);
  stop();
  expect(clock.paused).toBe(true);
  expect(native.remove).toHaveBeenCalledOnce();
});
it('pauses immediately when a training screen starts in the background', () => {
  const clock = new TrainingClock('beginner', null, () => {});
  native.app.currentState = 'background';
  clock.confirmPrompt();
  const stop = startTrainingClockLifecycle(clock, vi.fn());
  expect(clock.paused).toBe(true);
  stop();
});
it('reports a failed checkpoint and stops counting until an explicit retry', () => {
  let failing = false;
  const clock = new TrainingClock('beginner', null, () => {
    if (failing) throw new Error('disk full');
  });
  const publish = vi.fn();
  clock.confirmPrompt();
  const stop = startTrainingClockLifecycle(clock, publish);
  failing = true;
  vi.advanceTimersByTime(3000);
  expect(clock.paused).toBe(true);
  expect(publish).toHaveBeenCalledWith(expect.objectContaining({ message: 'disk full' }));
  stop();
});

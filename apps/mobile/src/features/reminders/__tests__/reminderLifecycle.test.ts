import { afterEach, expect, it, vi } from 'vitest';
import { startReminderLifecycle } from '../reminderLifecycle';

const mocks = vi.hoisted(() => ({
  listener: null as null | ((state: string) => void),
  sync: vi.fn(),
  remove: vi.fn(),
  state: { hasHydrated: true, isSyncing: false, nextReminderAt: null as number | null },
  app: { currentState: 'active' },
}));
vi.mock('react-native', () => ({
  AppState: Object.assign(mocks.app, {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mocks.listener = listener;
      return { remove: mocks.remove };
    },
  }),
}));
vi.mock('../reminderStore', () => ({
  useReminderStore: { getState: () => ({ ...mocks.state, syncSchedule: mocks.sync }) },
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.state.nextReminderAt = null;
});
it('calibrates on foreground and on a date change, and stops on cleanup', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 29, 23, 59));
  const stop = startReminderLifecycle();
  mocks.listener?.('background');
  expect(mocks.sync).not.toHaveBeenCalled();
  vi.advanceTimersByTime(60_000);
  expect(mocks.sync).toHaveBeenCalledOnce();
  mocks.listener?.('active');
  expect(mocks.sync).toHaveBeenCalledTimes(2);
  stop();
  vi.advanceTimersByTime(86_400_000);
  expect(mocks.sync).toHaveBeenCalledTimes(2);
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it('refreshes the next-time display after a scheduled time passes', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 29, 10));
  mocks.state.nextReminderAt = Date.now() + 30_000;
  const stop = startReminderLifecycle();
  vi.advanceTimersByTime(60_000);
  expect(mocks.sync).toHaveBeenCalledOnce();
  stop();
});

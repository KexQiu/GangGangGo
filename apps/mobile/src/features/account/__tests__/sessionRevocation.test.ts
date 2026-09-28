import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ values: new Map<string, string>(), revoke: vi.fn() }));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (key: string) => mocks.values.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mocks.values.set(key, value);
  },
}));
vi.mock('../../../api/client', () => ({ authApi: { revokeSession: mocks.revoke } }));
beforeEach(() => {
  mocks.values.clear();
  mocks.revoke.mockReset();
  vi.resetModules();
});

it('does not remove the logout marker before local cleanup, including a late rotated credential', async () => {
  const queue = await import('../sessionRevocation');
  await queue.queueSessionRevocation('refresh-A-before-rotation', 'A');
  mocks.revoke.mockResolvedValue({ ok: true });
  await queue.flushPendingSessionRevocations();
  expect(mocks.revoke).not.toHaveBeenCalled();
  expect(await queue.isSessionRevocationPending('refresh-A-after-rotation', 'A')).toBe(true);
  expect(await queue.isSessionRevocationPending('refresh-B', 'B')).toBe(false);
  await queue.markLocalRevocationsCleared();
  await queue.flushPendingSessionRevocations();
  expect(await queue.isSessionRevocationPending('refresh-A-after-rotation', 'A')).toBe(false);
});

it('keeps an offline logout across restart and sends only its original credential', async () => {
  const first = await import('../sessionRevocation');
  await first.queueSessionRevocation('refresh-A', 'A');
  await first.markLocalRevocationsCleared();
  mocks.revoke.mockRejectedValue(new Error('offline'));
  await first.flushPendingSessionRevocations();
  expect(await first.isSessionRevocationPending('refresh-A', 'A')).toBe(true);
  vi.resetModules();
  const restarted = await import('../sessionRevocation');
  mocks.revoke.mockResolvedValue({ ok: true });
  await restarted.flushPendingSessionRevocations();
  expect(mocks.revoke.mock.calls.map(([token]) => token)).toEqual(['refresh-A', 'refresh-A']);
  expect(await restarted.isSessionRevocationPending('refresh-A', 'A')).toBe(false);
});

it('preserves a second logout queued while the first network response is in flight', async () => {
  const queue = await import('../sessionRevocation');
  let release!: () => void;
  mocks.revoke
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue({ ok: true });
  await queue.queueSessionRevocation('refresh-A', 'A');
  await queue.markLocalRevocationsCleared();
  const flushing = queue.flushPendingSessionRevocations();
  await vi.waitFor(() => expect(release).toBeDefined());
  await queue.queueSessionRevocation('refresh-B', 'B');
  await queue.markLocalRevocationsCleared();
  release();
  await flushing;
  expect(mocks.revoke.mock.calls.map(([token]) => token)).toEqual(['refresh-A', 'refresh-B']);
  expect(await queue.isSessionRevocationPending('refresh-B', 'B')).toBe(false);
});

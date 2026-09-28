import { beforeEach, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-sqlite/kv-store', () => ({
  default: {
    getItemSync: (key: string) => storage.get(key) ?? null,
    setItemSync: (key: string, value: string) => storage.set(key, value),
  },
}));
beforeEach(() => storage.clear());

it('keeps snapshot order across restart and a backwards clock change', async () => {
  const first = await import('../watchStateRevision');
  expect(first.nextWatchStateRevision()).toBe(1);
  expect(first.nextWatchStateRevision()).toBe(2);
  vi.resetModules();
  const restarted = await import('../watchStateRevision');
  expect(restarted.nextWatchStateRevision()).toBe(3);
});

it('does not issue a revision if persisting it fails', async () => {
  const Storage = (await import('expo-sqlite/kv-store')).default;
  const write = vi.spyOn(Storage, 'setItemSync').mockImplementationOnce(() => {
    throw new Error('disk full');
  });
  const { nextWatchStateRevision } = await import('../watchStateRevision');
  expect(nextWatchStateRevision).toThrow('disk full');
  write.mockRestore();
  expect(nextWatchStateRevision()).toBe(1);
});

import { beforeEach, expect, it, vi } from 'vitest';
import { defaultReminderSettings } from '../reminderLogic';
import { useReminderStore } from '../reminderStore';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  permission: vi.fn(),
  cancel: vi.fn(),
  sync: vi.fn(),
}));
vi.mock('../../../storage/repositories/reminderRepository', () => ({
  getReminderSettings: mocks.read,
  upsertReminderSettings: mocks.write,
}));
vi.mock('../notificationService', () => ({
  cancelReminderNotifications: mocks.cancel,
  getReminderPermissionState: mocks.permission,
  requestReminderPermission: mocks.permission,
  syncReminderNotifications: mocks.sync,
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue(defaultReminderSettings);
  mocks.permission.mockResolvedValue('granted');
  mocks.sync.mockResolvedValue({ scheduledCount: 11, nextReminderAt: 123 });
  useReminderStore.setState({
    settings: defaultReminderSettings,
    hasHydrated: false,
    isHydrating: false,
    isSyncing: false,
    error: null,
    scheduledCount: 0,
    nextReminderAt: null,
  });
});
it('serializes quick enable/disable and setting writes so the last plan wins', async () => {
  let release!: () => void;
  mocks.sync.mockImplementationOnce(
    () =>
      new Promise<{ scheduledCount: number; nextReminderAt: number }>((resolve) => {
        release = () => resolve({ scheduledCount: 11, nextReminderAt: 123 });
      }),
  );
  const first = useReminderStore.getState().updateSettings({ sedentaryEnabled: true });
  const second = useReminderStore.getState().updateSettings({ sedentaryEnabled: false });
  await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledOnce());
  expect(mocks.write).toHaveBeenCalledOnce();
  release();
  await Promise.all([first, second]);
  expect(mocks.sync.mock.calls.map(([settings]) => settings.sedentaryEnabled)).toEqual([true, false]);
  expect(useReminderStore.getState().settings.sedentaryEnabled).toBe(false);
});
it('keeps the saved setting after disk failure and exposes retry instead of stale success', async () => {
  mocks.write.mockRejectedValueOnce(new Error('disk full'));
  await useReminderStore.getState().updateSettings({ sedentaryEnabled: true });
  expect(mocks.sync).not.toHaveBeenCalled();
  expect(useReminderStore.getState()).toMatchObject({
    error: 'disk full',
    nextReminderAt: null,
    settings: { sedentaryEnabled: false },
  });
  await useReminderStore.getState().updateSettings({ sedentaryEnabled: true });
  expect(useReminderStore.getState()).toMatchObject({ error: null, nextReminderAt: 123 });
});
it('clears notifications and next-time status after permission is revoked', async () => {
  await useReminderStore.getState().hydrate();
  mocks.permission.mockResolvedValue('denied');
  await useReminderStore.getState().syncSchedule();
  expect(mocks.cancel).toHaveBeenCalledOnce();
  expect(useReminderStore.getState()).toMatchObject({
    permissionStatus: 'denied',
    scheduledCount: 0,
    nextReminderAt: null,
  });
});
it('allows hydration retry without overwriting settings after a read failure', async () => {
  mocks.read.mockRejectedValueOnce(new Error('read failed'));
  await useReminderStore.getState().hydrate();
  expect(useReminderStore.getState().hasHydrated).toBe(false);
  await useReminderStore.getState().hydrate();
  expect(useReminderStore.getState().hasHydrated).toBe(true);
});

it('keeps training reminders disabled with their original times after schedule refresh and hydration', async () => {
  await useReminderStore.getState().updateSettings({ kegelEnabled: true, kegelTimes: ['10:00', '19:30'] });
  const refreshing = useReminderStore.getState().syncSchedule();
  const stopping = useReminderStore.getState().updateSettings({ kegelEnabled: false });
  await Promise.all([refreshing, stopping]);
  const saved = useReminderStore.getState().settings;
  expect(saved).toMatchObject({ kegelEnabled: false, kegelTimes: ['10:00', '19:30'] });
  mocks.read.mockResolvedValue(saved);
  mocks.sync.mockClear();
  useReminderStore.setState({ hasHydrated: false });
  await useReminderStore.getState().hydrate();
  await useReminderStore.getState().syncSchedule();
  expect(mocks.sync.mock.calls.every(([configuration]) => !configuration.kegelEnabled)).toBe(true);
});

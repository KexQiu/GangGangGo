import { create } from 'zustand';

import { getReminderSettings, upsertReminderSettings } from '../../storage/repositories/reminderRepository';
import { defaultReminderSettings, normalizeReminderSettings } from './reminderLogic';
import {
  cancelReminderNotifications,
  getReminderPermissionState,
  requestReminderPermission,
  syncReminderNotifications,
  type ReminderSchedule,
} from './notificationService';
import { type NotificationPermissionState, type ReminderSettings, type ReminderSettingsPatch } from './reminderTypes';

type ReminderState = ReminderSchedule & {
  error: string | null;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  isHydrating: boolean;
  isSyncing: boolean;
  permissionStatus: NotificationPermissionState;
  requestPermissionAndSync: () => Promise<void>;
  settings: ReminderSettings;
  syncSchedule: () => Promise<void>;
  updateSettings: (patch: ReminderSettingsPatch) => Promise<void>;
};

const emptySchedule: ReminderSchedule = { scheduledCount: 0, nextReminderAt: null };
// 设置持久化、权限与原生排程共用队列，避免旧排程在关闭开关后重新写入。
let queue: Promise<void> = Promise.resolve();
let pending = 0;

export const useReminderStore = create<ReminderState>((set, get) => {
  function enqueue(action: () => Promise<void>) {
    pending += 1;
    set({ isSyncing: true });
    queue = queue.then(async () => {
      set({ error: null, ...emptySchedule });
      try {
        await action();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '提醒更新失败，请重试。', ...emptySchedule });
      } finally {
        pending -= 1;
        set({ isSyncing: pending > 0 });
      }
    });
    return queue;
  }

  async function sync(permissionStatus?: NotificationPermissionState) {
    const permission = permissionStatus ?? (await getReminderPermissionState());
    set({ permissionStatus: permission });
    if (permission !== 'granted') {
      await cancelReminderNotifications();
      set(emptySchedule);
      return;
    }
    set(await syncReminderNotifications(get().settings));
  }

  async function loadSettings() {
    if (get().hasHydrated) return;
    set({ isHydrating: true });
    try {
      set({ settings: await getReminderSettings(), hasHydrated: true });
    } finally {
      set({ isHydrating: false });
    }
  }

  return {
    ...emptySchedule,
    error: null,
    hasHydrated: false,
    isHydrating: false,
    isSyncing: false,
    permissionStatus: 'unknown',
    settings: defaultReminderSettings,
    hydrate: () =>
      enqueue(async () => {
        await loadSettings();
        await sync();
      }),
    requestPermissionAndSync: () =>
      enqueue(async () => {
        await loadSettings();
        await sync(await requestReminderPermission());
      }),
    syncSchedule: () =>
      enqueue(async () => {
        await loadSettings();
        await sync();
      }),
    updateSettings: (patch) =>
      enqueue(async () => {
        await loadSettings();
        const settings = normalizeReminderSettings({
          ...get().settings,
          ...patch,
          updatedAt: new Date().toISOString(),
        });
        await upsertReminderSettings(settings);
        set({ settings });
        await sync();
      }),
  };
});

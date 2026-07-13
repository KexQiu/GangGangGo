import { create } from 'zustand';

import { getReminderSettings, upsertReminderSettings } from '../../storage/repositories/reminderRepository';
import { defaultReminderSettings, hasAnyReminderEnabled, normalizeReminderSettings } from './reminderLogic';
import {
  cancelReminderNotifications,
  configureNotificationHandler,
  getReminderPermissionState,
  requestReminderPermission,
  syncReminderNotifications,
} from './notificationService';
import { type NotificationPermissionState, type ReminderSettings, type ReminderSettingsPatch } from './reminderTypes';

type ReminderState = {
  error: string | null;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  isHydrating: boolean;
  isSyncing: boolean;
  permissionStatus: NotificationPermissionState;
  requestPermissionAndSync: () => Promise<void>;
  scheduledCount: number;
  settings: ReminderSettings;
  syncSchedule: () => Promise<void>;
  updateSettings: (patch: ReminderSettingsPatch) => Promise<void>;
};

export const useReminderStore = create<ReminderState>((set, get) => ({
  error: null,
  hasHydrated: false,
  hydrate: async () => {
    if (get().isHydrating || get().hasHydrated) {
      return;
    }

    configureNotificationHandler();
    set({ error: null, isHydrating: true });

    try {
      const settings = await getReminderSettings();
      const permissionStatus = await getReminderPermissionState();
      set({
        hasHydrated: true,
        isHydrating: false,
        permissionStatus,
        settings,
      });

      if (permissionStatus === 'granted' && hasAnyReminderEnabled(settings)) {
        await get().syncSchedule();
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '提醒设置加载失败',
        hasHydrated: true,
        isHydrating: false,
      });
    }
  },
  isHydrating: false,
  isSyncing: false,
  permissionStatus: 'unknown',
  requestPermissionAndSync: async () => {
    configureNotificationHandler();
    set({ error: null, isSyncing: true });

    try {
      const permissionStatus = await requestReminderPermission();
      set({ permissionStatus });

      if (permissionStatus !== 'granted') {
        set({
          error: permissionStatus === 'denied' ? '系统通知权限未开启' : null,
          isSyncing: false,
          scheduledCount: 0,
        });
        return;
      }

      const scheduledCount = hasAnyReminderEnabled(get().settings)
        ? await syncReminderNotifications(get().settings)
        : 0;
      set({ error: null, isSyncing: false, scheduledCount });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '提醒权限请求失败',
        isSyncing: false,
      });
    }
  },
  scheduledCount: 0,
  settings: defaultReminderSettings,
  syncSchedule: async () => {
    configureNotificationHandler();
    set({ error: null, isSyncing: true });

    try {
      if (!hasAnyReminderEnabled(get().settings)) {
        await cancelReminderNotifications();
        set({ isSyncing: false, scheduledCount: 0 });
        return;
      }

      const permissionStatus = await getReminderPermissionState();
      set({ permissionStatus });

      if (permissionStatus !== 'granted') {
        set({ isSyncing: false, scheduledCount: 0 });
        return;
      }

      const scheduledCount = await syncReminderNotifications(get().settings);
      set({ isSyncing: false, scheduledCount });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '提醒同步失败',
        isSyncing: false,
      });
    }
  },
  updateSettings: async (patch) => {
    const nextSettings = normalizeReminderSettings({
      ...get().settings,
      ...patch,
      updatedAt: new Date().toISOString(),
    });

    set({ error: null, settings: nextSettings });

    try {
      await upsertReminderSettings(nextSettings);
      await get().syncSchedule();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '提醒设置保存失败',
      });
    }
  },
}));

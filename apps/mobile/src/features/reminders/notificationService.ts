import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getSedentaryReminderTimes, getKegelReminderTimesOutsideQuietHours, getReminderCopy } from './reminderLogic';
import { type NotificationPermissionState, type ReminderKind, type ReminderSettings } from './reminderTypes';

const NOTIFICATION_APP_KEY = 'xiaotidu';
const NOTIFICATION_CHANNEL_ID = 'health-reminders';

let notificationHandlerConfigured = false;

export function configureNotificationHandler() {
  if (notificationHandlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  notificationHandlerConfigured = true;
}

export async function getReminderPermissionState(): Promise<NotificationPermissionState> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    return isNotificationAllowed(permission) ? 'granted' : permission.status === 'denied' ? 'denied' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function requestReminderPermission(): Promise<NotificationPermissionState> {
  try {
    const permission = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: false,
      },
    });

    return isNotificationAllowed(permission) ? 'granted' : permission.status === 'denied' ? 'denied' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export type ReminderSchedule = { scheduledCount: number; nextReminderAt: number | null };

export async function syncReminderNotifications(settings: ReminderSettings): Promise<ReminderSchedule> {
  configureNotificationHandler();
  await cancelReminderNotifications();
  await ensureAndroidNotificationChannel();
  let scheduledCount = 0;
  let nextReminderAt: number | null = null;
  const groups: Array<[ReminderKind, string[]]> = [
    ['kegel', settings.kegelEnabled ? getKegelReminderTimesOutsideQuietHours(settings) : []],
    ['sedentary', getSedentaryReminderTimes(settings)],
  ];
  try {
    for (const [kind, times] of groups) {
      for (const time of new Set(times)) {
        const [hour, minute] = time.split(':').map(Number);
        const trigger: Notifications.DailyTriggerInput = {
          channelId: NOTIFICATION_CHANNEL_ID,
          hour,
          minute,
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
        };
        await scheduleReminderNotification(kind, settings, {
          identifier: `xiaotidu-${kind}-${time}`,
          trigger,
        });
        const next = await Notifications.getNextTriggerDateAsync(trigger);
        if (next === null) throw new Error('系统未返回下次提醒时间，请重试。');
        nextReminderAt = Math.min(nextReminderAt ?? next, next);
        scheduledCount += 1;
      }
    }
    return { scheduledCount, nextReminderAt };
  } catch (error) {
    // 不把只排入部分的计划展示为成功；下一次校准会重新清理。
    await cancelReminderNotifications().catch(() => undefined);
    throw error;
  }
}

export async function cancelReminderNotifications(): Promise<void> {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const appNotifications = scheduledNotifications.filter((notification) => {
    const data = notification.content.data;
    return data && data.app === NOTIFICATION_APP_KEY && (data.kind === 'kegel' || data.kind === 'sedentary');
  });

  await Promise.all(
    appNotifications.map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)),
  );
}

type ScheduleReminderOptions = {
  identifier: string;
  trigger: Notifications.NotificationTriggerInput;
};

async function scheduleReminderNotification(
  kind: ReminderKind,
  settings: ReminderSettings,
  options: ScheduleReminderOptions,
) {
  const copy = getReminderCopy(kind, settings.privacyMode);

  await Notifications.scheduleNotificationAsync({
    content: {
      body: copy.body,
      data: {
        app: NOTIFICATION_APP_KEY,
        kind,
      },
      sound: false,
      title: copy.title,
    },
    identifier: options.identifier,
    trigger: options.trigger,
  });
}

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    description: '小训练和活动提醒',
    enableVibrate: true,
    importance: Notifications.AndroidImportance.DEFAULT,
    name: '健康提醒',
    showBadge: false,
    vibrationPattern: [0, 180, 80, 180],
  });
}

function isNotificationAllowed(permission: Notifications.NotificationPermissionsStatus): boolean {
  return permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

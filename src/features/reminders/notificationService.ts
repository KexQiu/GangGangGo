import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  buildSedentaryReminderDates,
  getKegelReminderTimesOutsideQuietHours,
  getReminderCopy,
} from './reminderLogic';
import {
  type NotificationPermissionState,
  type ReminderKind,
  type ReminderSettings,
} from './reminderTypes';

const NOTIFICATION_APP_KEY = 'gangganggo';
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

export async function syncReminderNotifications(settings: ReminderSettings): Promise<number> {
  configureNotificationHandler();
  await cancelReminderNotifications();
  await ensureAndroidNotificationChannel();

  let scheduledCount = 0;

  if (settings.kegelEnabled) {
    const times = getKegelReminderTimesOutsideQuietHours(settings);

    for (const time of times) {
      const [hour, minute] = time.split(':').map(Number);
      await scheduleReminderNotification('kegel', settings, {
        identifier: `gangganggo-kegel-${time}`,
        trigger: {
          channelId: NOTIFICATION_CHANNEL_ID,
          hour,
          minute,
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
        },
      });
      scheduledCount += 1;
    }
  }

  if (settings.sedentaryEnabled) {
    const dates = buildSedentaryReminderDates(settings);

    for (const date of dates) {
      await scheduleReminderNotification('sedentary', settings, {
        identifier: `gangganggo-sedentary-${date.getTime()}`,
        trigger: {
          channelId: NOTIFICATION_CHANNEL_ID,
          date,
          type: Notifications.SchedulableTriggerInputTypes.DATE,
        },
      });
      scheduledCount += 1;
    }
  }

  return scheduledCount;
}

export async function cancelReminderNotifications(): Promise<void> {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const appNotifications = scheduledNotifications.filter((notification) => {
    const data = notification.content.data;
    return data && data.app === NOTIFICATION_APP_KEY;
  });

  await Promise.all(
    appNotifications.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(notification.identifier),
    ),
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

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  configureNotificationHandler,
  getReminderPermissionState,
  requestReminderPermission,
} from '../reminders/notificationService';
import { getToiletTimerStage } from './toiletLogic';
import { type ToiletTimerStage } from './toiletTypes';

const TOILET_STAGE_APP_KEY = 'xiaotidu-toilet-stage';
const TOILET_STAGE_CHANNEL_ID = 'toilet-stage-reminders';

type ToiletStageNotification = {
  body: string;
  stage: Exclude<ToiletTimerStage, 'normal'>;
  thresholdSeconds: number;
  title: string;
};

const toiletStageNotifications: ToiletStageNotification[] = [
  {
    body: '正事办完就撤。',
    stage: 'gentle_warning',
    thresholdSeconds: 5 * 60,
    title: '小声敲门',
  },
  {
    body: '差不多该收工了，别让局部压力加班。',
    stage: 'strong_warning',
    thresholdSeconds: 10 * 60,
    title: '差不多该收工了',
  },
  {
    body: '这趟有点长，先收工，手机小剧场下次再播。',
    stage: 'overtime',
    thresholdSeconds: 15 * 60,
    title: '蹲会儿长会了',
  },
  {
    body: '真的该收工了，给小花一点下班时间。',
    stage: 'severe_warning',
    thresholdSeconds: 20 * 60,
    title: '真的该收工了',
  },
];

export async function ensureToiletStageNotificationPermission(): Promise<boolean> {
  configureNotificationHandler();

  const permissionState = await getReminderPermissionState();
  if (permissionState === 'granted') {
    return true;
  }

  if (permissionState === 'denied') {
    return false;
  }

  return (await requestReminderPermission()) === 'granted';
}

export async function syncToiletStageNotifications(elapsedSeconds: number, now = new Date()): Promise<void> {
  configureNotificationHandler();
  await cancelToiletStageNotifications();

  if ((await getReminderPermissionState()) !== 'granted') {
    return;
  }

  await ensureToiletStageNotificationChannel();

  const currentStage = getToiletTimerStage(elapsedSeconds);
  if (currentStage === 'severe_warning') {
    return;
  }

  await Promise.all(
    toiletStageNotifications
      .filter((notification) => notification.thresholdSeconds > elapsedSeconds + 1)
      .map((notification) => scheduleToiletStageNotification(notification, elapsedSeconds, now)),
  );
}

export async function cancelToiletStageNotifications(): Promise<void> {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const toiletNotifications = scheduledNotifications.filter((notification) => {
    const data = notification.content.data;
    return data && data.app === TOILET_STAGE_APP_KEY;
  });

  await Promise.all(
    toiletNotifications.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(notification.identifier),
    ),
  );
}

async function scheduleToiletStageNotification(
  notification: ToiletStageNotification,
  elapsedSeconds: number,
  now: Date,
) {
  const remainingSeconds = Math.max(1, notification.thresholdSeconds - elapsedSeconds);

  await Notifications.scheduleNotificationAsync({
    content: {
      body: notification.body,
      data: {
        app: TOILET_STAGE_APP_KEY,
        kind: 'toilet-stage',
        stage: notification.stage,
      },
      sound: false,
      title: notification.title,
    },
    identifier: `xiaotidu-toilet-stage-${notification.thresholdSeconds}`,
    trigger: {
      channelId: TOILET_STAGE_CHANNEL_ID,
      date: new Date(now.getTime() + remainingSeconds * 1000),
      type: Notifications.SchedulableTriggerInputTypes.DATE,
    },
  });
}

async function ensureToiletStageNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(TOILET_STAGE_CHANNEL_ID, {
    description: '蹲会儿阶段提醒',
    enableVibrate: true,
    importance: Notifications.AndroidImportance.DEFAULT,
    name: '蹲会儿提醒',
    showBadge: false,
    vibrationPattern: [0, 160, 80, 220],
  });
}

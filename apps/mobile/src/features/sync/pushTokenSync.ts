import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiClient } from '../../api/client';
import { useAuthStore } from '../account/authStore';

export async function registerPushTokenIfAllowed(): Promise<boolean> {
  const accessToken = useAuthStore.getState().accessToken;

  if (!accessToken || Platform.OS === 'web') {
    return false;
  }

  try {
    const permission = await ensurePushPermission();

    if (!isNotificationAllowed(permission)) {
      logPushTokenDebug('notification permission is not granted');
      return false;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

    await apiClient.registerPushToken(
      {
        platform: Platform.OS === 'android' ? 'android' : 'ios',
        provider: 'expo',
        token: token.data,
      },
      accessToken,
    );

    return true;
  } catch (error) {
    logPushTokenDebug('failed to register push token', error);
    return false;
  }
}

async function ensurePushPermission() {
  const permission = await Notifications.getPermissionsAsync();

  if (isNotificationAllowed(permission) || permission.status === 'denied') {
    return permission;
  }

  return Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
}

function isNotificationAllowed(permission: Notifications.NotificationPermissionsStatus): boolean {
  return permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

function logPushTokenDebug(message: string, error?: unknown) {
  if (!__DEV__) {
    return;
  }

  if (error) {
    console.warn(`[push-token] ${message}`, error);
    return;
  }

  console.warn(`[push-token] ${message}`);
}

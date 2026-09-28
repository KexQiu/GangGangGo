import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Storage from 'expo-sqlite/kv-store';

import { pushApi } from '../../api/client';
import { useAuthStore } from '../account/authStore';
import { authSessionContext } from '../../api/sessionContext';
import { flushPendingSessionRevocations } from '../account/sessionRevocation';

export async function registerPushTokenIfAllowed(): Promise<boolean> {
  const accessToken = useAuthStore.getState().accessToken;
  const owner = authSessionContext.current();

  if (!accessToken || !owner || Platform.OS === 'web') {
    return false;
  }

  try {
    await flushPendingSessionRevocations();
    const permission = await ensurePushPermission();
    authSessionContext.assertCurrent(owner);

    if (!isNotificationAllowed(permission)) {
      await pushApi.revokeDevice(getPushDeviceId(), accessToken);
      logPushTokenDebug('notification permission is not granted');
      return false;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    authSessionContext.assertCurrent(owner);

    await pushApi.registerPushToken(
      {
        deviceId: getPushDeviceId(),
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

function getPushDeviceId() {
  const key = 'xiaotidu-push-device-id';
  let id = Storage.getItemSync(key);
  if (!id) {
    id = `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    Storage.setItemSync(key, id);
  }
  return id;
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

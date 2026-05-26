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
    const permission = await Notifications.getPermissionsAsync();

    if (!permission.granted) {
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
  } catch {
    return false;
  }
}

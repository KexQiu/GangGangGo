import * as SecureStore from 'expo-secure-store';

import { authSessionSchema, type AuthSession } from '@xiaotidu/contracts';

const sessionKey = 'xiaotidu-auth-session-v2';

export async function loadSecureSession(): Promise<AuthSession | null> {
  try {
    const value = await SecureStore.getItemAsync(sessionKey);
    if (!value) return null;
    const parsed = authSessionSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveSecureSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(sessionKey, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearSecureSession(): Promise<void> {
  await SecureStore.deleteItemAsync(sessionKey);
}

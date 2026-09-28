import * as SecureStore from 'expo-secure-store';

import { authResponseSchema, type AuthResponse } from '@xiaotidu/contracts';

const sessionKey = 'xiaotidu-owned-auth-session';

export type StoredSession = AuthResponse & { profileId: string };

export async function loadSecureSession(): Promise<StoredSession | null> {
  const value = await SecureStore.getItemAsync(sessionKey);
  if (!value) return null;
  try {
    const envelope = JSON.parse(value);
    const parsed = authResponseSchema.safeParse(envelope);
    return parsed.success && typeof envelope.profileId === 'string' && envelope.profileId.length > 0
      ? { ...parsed.data, profileId: envelope.profileId }
      : null;
  } catch {
    return null;
  }
}

export async function saveSecureSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(sessionKey, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearSecureSession(): Promise<void> {
  await SecureStore.deleteItemAsync(sessionKey);
}

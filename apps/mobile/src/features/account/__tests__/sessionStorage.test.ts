import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSecureSession, loadSecureSession, saveSecureSession, type StoredSession } from '../sessionStorage';

const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
}));
vi.mock('expo-secure-store', () => secureStore);

const stored: StoredSession = {
  profileId: 'profile-A',
  user: { id: '00000000-0000-4000-8000-000000000001', nickname: 'A', avatarUrl: null, timezone: 'Asia/Shanghai' },
  session: { accessToken: 'access', refreshToken: 'refresh', accessTokenExpiresAt: '2026-09-28T12:00:00.000Z' },
};
beforeEach(() => vi.resetAllMocks());

describe('owned secure session', () => {
  it('round-trips both credentials and local ownership in one value', async () => {
    await saveSecureSession(stored);
    const [key, value, options] = secureStore.setItemAsync.mock.calls[0];
    expect(options).toEqual({ keychainAccessible: 'device-only' });
    secureStore.getItemAsync.mockResolvedValue(value);
    await expect(loadSecureSession()).resolves.toEqual(stored);
    expect(secureStore.getItemAsync).toHaveBeenCalledWith(key);
    await clearSecureSession();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(key);
  });

  it.each([null, '{', JSON.stringify(stored.session), JSON.stringify({ ...stored, profileId: '' })])(
    'rejects missing or incomplete ownership: %s',
    async (value) => {
      secureStore.getItemAsync.mockResolvedValue(value);
      await expect(loadSecureSession()).resolves.toBeNull();
    },
  );

  it('keeps secure storage errors distinguishable from a missing session', async () => {
    const failure = new Error('keychain unavailable');
    secureStore.getItemAsync.mockRejectedValue(failure);
    await expect(loadSecureSession()).rejects.toBe(failure);
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});

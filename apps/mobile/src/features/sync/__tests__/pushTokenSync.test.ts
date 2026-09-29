import { beforeEach, expect, it, vi } from 'vitest';
import { authSessionContext } from '../../../api/sessionContext';
import { registerPushTokenIfAllowed } from '../pushTokenSync';

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  token: vi.fn(),
  register: vi.fn(),
  revoke: vi.fn(),
  values: new Map<string, string>(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-constants', () => ({ default: { expoConfig: {} } }));
vi.mock('expo-notifications', () => ({
  getPermissionsAsync: mocks.permission,
  getExpoPushTokenAsync: mocks.token,
  requestPermissionsAsync: mocks.permission,
  IosAuthorizationStatus: { PROVISIONAL: 3 },
}));
vi.mock('expo-sqlite/kv-store', () => ({
  default: {
    getItemSync: (key: string) => mocks.values.get(key) ?? null,
    setItemSync: (key: string, value: string) => mocks.values.set(key, value),
  },
}));
vi.mock('../../../api/client', () => ({ pushApi: { registerPushToken: mocks.register, revokeDevice: mocks.revoke } }));
vi.mock('../../account/authStore', () => ({
  useAuthStore: { getState: () => ({ accessToken: authSessionContext.current()?.accessToken }) },
}));
vi.mock('../../account/sessionRevocation', () => ({ flushPendingSessionRevocations: async () => undefined }));

function activate(userId: string) {
  authSessionContext.activate({
    userId,
    profileId: userId,
    accessToken: `token-${userId}`,
    generation: authSessionContext.beginTransition(),
  });
}
beforeEach(() => {
  vi.stubGlobal('__DEV__', false);
  vi.clearAllMocks();
  mocks.values.clear();
  activate('A');
  mocks.permission.mockResolvedValue({ granted: true, status: 'granted' });
  mocks.token.mockResolvedValue({ data: 'ExpoPushToken[test]' });
});

it('does not register an old account after permission completes during an account switch', async () => {
  let release!: (permission: { granted: boolean }) => void;
  mocks.permission.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const registering = registerPushTokenIfAllowed();
  await vi.waitFor(() => expect(release).toBeDefined());
  activate('B');
  release({ granted: true });
  expect(await registering).toMatchObject({ outcome: 'skipped' });
  expect(mocks.register).not.toHaveBeenCalled();
});

it('keeps one device identity across account changes', async () => {
  expect(await registerPushTokenIfAllowed()).toEqual({ outcome: 'success' });
  const deviceId = mocks.register.mock.calls[0]![0].deviceId;
  activate('B');
  expect(await registerPushTokenIfAllowed()).toEqual({ outcome: 'success' });
  expect(mocks.register.mock.calls[1]).toEqual([expect.objectContaining({ deviceId }), 'token-B']);
});

it('revokes this device binding when notification permission is denied', async () => {
  mocks.permission.mockResolvedValue({ granted: false, status: 'denied' });
  expect(await registerPushTokenIfAllowed()).toMatchObject({ outcome: 'skipped' });
  expect(mocks.revoke).toHaveBeenCalledWith(expect.stringMatching(/^device-/), 'token-A');
  expect(mocks.register).not.toHaveBeenCalled();
});

it('reports registration errors as failures so the coordinator can offer a retry', async () => {
  mocks.register.mockRejectedValueOnce(new Error('offline'));
  await expect(registerPushTokenIfAllowed()).rejects.toThrow('offline');
  expect(await registerPushTokenIfAllowed()).toEqual({ outcome: 'success' });
});

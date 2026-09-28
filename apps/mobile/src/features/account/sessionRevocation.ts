import * as SecureStore from 'expo-secure-store';
import { authApi } from '../../api/client';

const key = 'xiaotidu-pending-session-revocations';
let writes: Promise<unknown> = Promise.resolve();
let flushing: Promise<void> | null = null;
type PendingRevocation = { refreshToken: string; userId: string; localCleared: boolean };

function exclusive<T>(action: () => Promise<T>) {
  const result = writes.then(action);
  writes = result.catch(() => undefined);
  return result;
}
async function read(): Promise<PendingRevocation[]> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        entry &&
        typeof entry.refreshToken === 'string' &&
        typeof entry.userId === 'string' &&
        typeof entry.localCleared === 'boolean',
    )
  )
    throw new Error('退出补偿记录无法读取，请重试。');
  return value;
}
async function write(tokens: PendingRevocation[]) {
  await SecureStore.setItemAsync(key, JSON.stringify(tokens), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/** Persist before clearing the active secure session. Network failure must not lose the revoke. */
export async function queueSessionRevocation(refreshToken: string, userId: string) {
  await exclusive(async () => {
    const tokens = await read();
    if (!tokens.some((entry) => entry.refreshToken === refreshToken))
      await write([...tokens, { refreshToken, userId, localCleared: false }]);
  });
}

export function isSessionRevocationPending(refreshToken: string, userId: string) {
  return exclusive(async () =>
    (await read()).some(
      (entry) => entry.refreshToken === refreshToken || (!entry.localCleared && entry.userId === userId),
    ),
  );
}

/** Called inside the auth side-effect queue, only after the secure session is deleted. */
export function markLocalRevocationsCleared() {
  return exclusive(async () => {
    const entries = await read();
    if (entries.some((entry) => !entry.localCleared))
      await write(entries.map((entry) => ({ ...entry, localCleared: true })));
  });
}

export function flushPendingSessionRevocations(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    const attempted = new Set<string>();
    for (;;) {
      const entry = (await exclusive(read)).find(
        (pending) => pending.localCleared && !attempted.has(pending.refreshToken),
      );
      if (!entry) break;
      const token = entry.refreshToken;
      attempted.add(token);
      try {
        // Explicit original credential; never refresh or borrow the current account's token.
        await authApi.revokeSession(token);
        await exclusive(async () => write((await read()).filter((pending) => pending.refreshToken !== token)));
      } catch {
        /* Offline or failed ACK: retain for launch/foreground/next registration. */
      }
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

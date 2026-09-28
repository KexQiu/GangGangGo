import Storage from 'expo-sqlite/kv-store';

const key = 'xiaotidu-watch-state-revision';

/** Allocate before transmission; persisted across account changes and process restarts. */
export function nextWatchStateRevision() {
  const stored = Number(Storage.getItemSync(key) ?? '0');
  if (!Number.isSafeInteger(stored) || stored < 0 || stored >= Number.MAX_SAFE_INTEGER)
    throw new Error('无法读取手表状态序列，请重试。');
  const revision = stored + 1;
  Storage.setItemSync(key, String(revision));
  return revision;
}

export type LocalDataChangeSource = 'local' | 'remote';
type LocalDataChangeListener = (revision: number, source: LocalDataChangeSource) => void;

const listeners = new Set<LocalDataChangeListener>();
let revision = 0;

export function getLocalDataRevision() {
  return revision;
}

export function notifyLocalDataChanged(source: LocalDataChangeSource = 'local') {
  revision += 1;
  for (const listener of listeners) {
    try {
      listener(revision, source);
    } catch (error) {
      console.warn('本地数据变更监听失败', error);
    }
  }
}

export function subscribeToLocalDataChanges(listener: LocalDataChangeListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

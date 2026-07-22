export type LocalDataChangeSource = 'local' | 'remote';
type LocalDataChangeListener = (revision: number, source: LocalDataChangeSource) => void;

const listeners = new Set<LocalDataChangeListener>();
let revision = 0;

export function getLocalDataRevision() {
  return revision;
}

export function notifyLocalDataChanged(source: LocalDataChangeSource = 'local') {
  revision += 1;
  for (const listener of listeners) listener(revision, source);
}

export function subscribeToLocalDataChanges(listener: LocalDataChangeListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type LocalDataChangeListener = (revision: number) => void;

const listeners = new Set<LocalDataChangeListener>();
let revision = 0;

export function getLocalDataRevision() {
  return revision;
}

export function notifyLocalDataChanged() {
  revision += 1;
  for (const listener of listeners) listener(revision);
}

export function subscribeToLocalDataChanges(listener: LocalDataChangeListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

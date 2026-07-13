import { create } from 'zustand';

import { insertToiletSession, listToiletSessions } from '../../storage/repositories/toiletRepository';
import { notifyLocalDataChanged } from '../sync/localDataEvents';
import { type ToiletSession } from './toiletTypes';

type ToiletState = {
  addSession: (session: ToiletSession) => Promise<void>;
  error: string | null;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  isHydrating: boolean;
  sessions: ToiletSession[];
};

export const useToiletStore = create<ToiletState>((set, get) => ({
  addSession: async (session) => {
    set((state) => ({
      error: null,
      sessions: [session, ...state.sessions],
    }));

    try {
      await insertToiletSession(session);
      notifyLocalDataChanged();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '如厕记录保存失败',
      });
    }
  },
  error: null,
  hasHydrated: false,
  hydrate: async () => {
    if (get().isHydrating || get().hasHydrated) {
      return;
    }

    set({ error: null, isHydrating: true });

    try {
      const since = new Date();
      since.setDate(since.getDate() - 366);
      const sessions = await listToiletSessions(since.toISOString());
      set({ hasHydrated: true, isHydrating: false, sessions });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '如厕记录加载失败',
        hasHydrated: true,
        isHydrating: false,
      });
    }
  },
  isHydrating: false,
  sessions: [],
}));

export function getTodayToiletSessionCount(sessions: ToiletSession[], now = new Date()): number {
  return sessions.filter((session) => isSameLocalDate(new Date(session.endedAt), now)).length;
}

function isSameLocalDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

import { create } from 'zustand';

import { buildLocalDateRange } from '../../storage/dateRange';
import { collectAllPages } from '../../storage/pagination';
import {
  deleteToiletSession,
  insertToiletSession,
  listToiletSessionsPage,
  updateToiletSession,
  type ToiletSessionCursor,
} from '../../storage/repositories/toiletRepository';
import { notifyLocalDataChanged } from '../sync/localDataEvents';
import { type ToiletSession } from './toiletTypes';

type ToiletState = {
  addSession: (session: ToiletSession) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  error: string | null;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  isHydrating: boolean;
  revision: number;
  sessions: ToiletSession[];
  updateSession: (session: ToiletSession) => Promise<void>;
};

export const useToiletStore = create<ToiletState>((set, get) => ({
  addSession: async (session) => {
    set((state) => ({
      error: null,
      sessions: [session, ...state.sessions],
    }));

    try {
      await insertToiletSession(session);
      set((state) => ({ revision: state.revision + 1 }));
      notifyLocalDataChanged();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '如厕记录保存失败',
        sessions: get().sessions.filter((item) => item.id !== session.id),
      });
      throw error;
    }
  },
  deleteSession: async (id) => {
    const previousSession = get().sessions.find((session) => session.id === id);
    set((state) => ({ error: null, sessions: state.sessions.filter((session) => session.id !== id) }));

    try {
      await deleteToiletSession(id);
      set((state) => ({ revision: state.revision + 1 }));
      notifyLocalDataChanged();
    } catch (error) {
      set((state) => ({
        error: error instanceof Error ? error.message : '如厕记录删除失败',
        sessions: previousSession ? [previousSession, ...state.sessions] : state.sessions,
      }));
      throw error;
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
      const range = buildLocalDateRange(30);
      const sessions = await collectAllPages<ToiletSession, ToiletSessionCursor>((cursor) =>
        listToiletSessionsPage({
          cursor,
          fromDateTime: range.fromDateTime,
          limit: 250,
          toDateTimeExclusive: range.toDateTimeExclusive,
        }),
      );
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
  revision: 0,
  sessions: [],
  updateSession: async (session) => {
    const previousSession = get().sessions.find((item) => item.id === session.id);
    set((state) => ({
      error: null,
      sessions: state.sessions.map((item) => (item.id === session.id ? session : item)),
    }));

    try {
      await updateToiletSession(session);
      set((state) => ({ revision: state.revision + 1 }));
      notifyLocalDataChanged();
    } catch (error) {
      set((state) => ({
        error: error instanceof Error ? error.message : '如厕记录更新失败',
        sessions: previousSession
          ? state.sessions.map((item) => (item.id === session.id ? previousSession : item))
          : state.sessions,
      }));
      throw error;
    }
  },
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

import { authSessionContext } from '../../api/sessionContext';
import type { LocalMutationOptions, LocalMutationResult } from '../../storage/localMutation';
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
  addSession: (session: ToiletSession, options?: LocalMutationOptions) => Promise<LocalMutationResult>;
  deleteSession: (id: string) => Promise<void>;
  error: string | null;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  reset: () => void;
  isHydrating: boolean;
  revision: number;
  sessions: ToiletSession[];
  updateSession: (session: ToiletSession) => Promise<void>;
};

let hydrationRevision = 0;

export const useToiletStore = create<ToiletState>((set, get) => ({
  addSession: async (session, options = {}) => {
    const generation = options.generation ?? authSessionContext.captureLocalGeneration();
    try {
      const result = await insertToiletSession(session, { ...options, generation });
      if (result.status === 'saved' && authSessionContext.isGenerationCurrent(generation)) {
        set((state) => ({
          error: null,
          revision: state.revision + 1,
          sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)],
        }));
        notifyLocalDataChanged();
      }
      return result;
    } catch (error) {
      if (authSessionContext.isGenerationCurrent(generation))
        set({ error: error instanceof Error ? error.message : '如厕记录保存失败' });
      throw error;
    }
  },
  deleteSession: async (id) => {
    const generation = authSessionContext.captureLocalGeneration();
    try {
      await deleteToiletSession(id, { generation });
      if (authSessionContext.isGenerationCurrent(generation)) {
        set((state) => ({
          error: null,
          revision: state.revision + 1,
          sessions: state.sessions.filter((session) => session.id !== id),
        }));
        notifyLocalDataChanged();
      }
    } catch (error) {
      if (authSessionContext.isGenerationCurrent(generation))
        set({ error: error instanceof Error ? error.message : '如厕记录删除失败' });
      throw error;
    }
  },
  error: null,
  hasHydrated: false,
  reset: () => {
    hydrationRevision += 1;
    set({ error: null, hasHydrated: false, isHydrating: false, sessions: [] });
  },
  hydrate: async () => {
    if (get().isHydrating || get().hasHydrated) {
      return;
    }

    const revision = ++hydrationRevision;
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
      if (revision !== hydrationRevision) return;
      set({ hasHydrated: true, isHydrating: false, sessions });
    } catch (error) {
      if (revision !== hydrationRevision) return;
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
    const generation = authSessionContext.captureLocalGeneration();
    try {
      await updateToiletSession(session, { generation });
      if (authSessionContext.isGenerationCurrent(generation)) {
        set((state) => ({
          error: null,
          revision: state.revision + 1,
          sessions: state.sessions.map((item) => (item.id === session.id ? session : item)),
        }));
        notifyLocalDataChanged();
      }
    } catch (error) {
      if (authSessionContext.isGenerationCurrent(generation))
        set({ error: error instanceof Error ? error.message : '如厕记录更新失败' });
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

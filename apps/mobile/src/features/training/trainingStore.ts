import { create } from 'zustand';

import { buildLocalDateRange } from '../../storage/dateRange';
import { collectAllPages } from '../../storage/pagination';
import {
  insertTrainingSession,
  listTrainingSessionsPage,
  type TrainingSessionCursor,
} from '../../storage/repositories/trainingRepository';
import { notifyLocalDataChanged } from '../sync/localDataEvents';
import { type TrainingSession } from './trainingTypes';

type TrainingState = {
  error: string | null;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  reset: () => void;
  isHydrating: boolean;
  sessions: TrainingSession[];
  addSession: (session: TrainingSession) => Promise<void>;
};

let hydrationRevision = 0;

export const useTrainingStore = create<TrainingState>((set, get) => ({
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
      const sessions = await collectAllPages<TrainingSession, TrainingSessionCursor>((cursor) =>
        listTrainingSessionsPage({
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
        error: error instanceof Error ? error.message : '训练记录加载失败',
        hasHydrated: true,
        isHydrating: false,
      });
    }
  },
  isHydrating: false,
  sessions: [],
  addSession: async (session) => {
    set((state) => ({
      error: null,
      sessions: [session, ...state.sessions],
    }));

    try {
      await insertTrainingSession(session);
      notifyLocalDataChanged();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '训练记录保存失败',
      });
    }
  },
}));

export function getTodayCompletedTrainingCount(sessions: TrainingSession[], now = new Date()): number {
  return sessions.filter((session) => session.isCompleted && isSameLocalDate(new Date(session.endedAt), now)).length;
}

function isSameLocalDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

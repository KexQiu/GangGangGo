import { authSessionContext } from '../../api/sessionContext';
import type { LocalMutationOptions, LocalMutationResult } from '../../storage/localMutation';
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
  addSession: (session: TrainingSession, options?: LocalMutationOptions) => Promise<LocalMutationResult>;
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
  addSession: async (session, options = {}) => {
    const generation = options.generation ?? authSessionContext.captureLocalGeneration();
    try {
      const result = await insertTrainingSession(session, { ...options, generation });
      if (result.status === 'saved' && authSessionContext.isGenerationCurrent(generation)) {
        set((state) => ({
          error: null,
          sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)],
        }));
        notifyLocalDataChanged();
      }
      return result;
    } catch (error) {
      if (authSessionContext.isGenerationCurrent(generation))
        set({ error: error instanceof Error ? error.message : '训练记录保存失败' });
      throw error;
    }
  },
}));

export function getTodayTrainingRecordCount(sessions: TrainingSession[], now = new Date()): number {
  return sessions.filter((session) => isSameLocalDate(new Date(session.endedAt), now)).length;
}

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

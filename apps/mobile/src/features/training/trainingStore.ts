import { create } from 'zustand';

import { insertTrainingSession, listTrainingSessions } from '../../storage/repositories/trainingRepository';
import { type TrainingSession } from './trainingTypes';

type TrainingState = {
  error: string | null;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  isHydrating: boolean;
  sessions: TrainingSession[];
  addSession: (session: TrainingSession) => Promise<void>;
};

export const useTrainingStore = create<TrainingState>((set, get) => ({
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
      const sessions = await listTrainingSessions(since.toISOString());
      set({ hasHydrated: true, isHydrating: false, sessions });
    } catch (error) {
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

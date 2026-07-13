import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { notifyLocalDataChanged } from '../sync/localDataEvents';

export type ActiveToiletTimerSession = {
  baseElapsedSeconds: number;
  isPaused: boolean;
  lastResumedAt: string | null;
  liveActivityId: string | null;
  startedAt: string;
};

type ToiletTimerSessionState = {
  clearSession: () => void;
  pauseSession: (elapsedSeconds: number) => void;
  resumeSession: () => void;
  session: ActiveToiletTimerSession | null;
  setLiveActivityId: (activityId: string | null) => void;
  startSession: (startedAt: string) => void;
};

export const useToiletTimerSessionStore = create<ToiletTimerSessionState>()(
  persist(
    (set, get) => ({
      clearSession: () => {
        if (!get().session) return;
        set({ session: null });
        notifyLocalDataChanged();
      },
      pauseSession: (elapsedSeconds) => {
        if (!get().session) return;
        set((state) => {
          if (!state.session) return state;

          return {
            session: {
              ...state.session,
              baseElapsedSeconds: Math.max(0, Math.floor(elapsedSeconds)),
              isPaused: true,
              lastResumedAt: null,
            },
          };
        });
        notifyLocalDataChanged();
      },
      resumeSession: () => {
        if (!get().session) return;
        set((state) => {
          if (!state.session) return state;

          return {
            session: {
              ...state.session,
              isPaused: false,
              lastResumedAt: new Date().toISOString(),
            },
          };
        });
        notifyLocalDataChanged();
      },
      session: null,
      setLiveActivityId: (activityId) => {
        if (!get().session) return;
        set((state) => {
          if (!state.session) return state;

          return {
            session: {
              ...state.session,
              liveActivityId: activityId,
            },
          };
        });
        notifyLocalDataChanged();
      },
      startSession: (startedAt) => {
        set({
          session: {
            baseElapsedSeconds: 0,
            isPaused: false,
            lastResumedAt: startedAt,
            liveActivityId: null,
            startedAt,
          },
        });
        notifyLocalDataChanged();
      },
    }),
    {
      name: 'xiaotidu-active-toilet-timer',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
      }),
    },
  ),
);

export function getActiveToiletTimerElapsedSeconds(session: ActiveToiletTimerSession | null, now = new Date()): number {
  if (!session) {
    return 0;
  }

  if (session.isPaused || !session.lastResumedAt) {
    return Math.max(0, Math.floor(session.baseElapsedSeconds));
  }

  const lastResumedAt = new Date(session.lastResumedAt).getTime();
  const elapsedSinceResume = Number.isFinite(lastResumedAt)
    ? Math.max(0, Math.floor((now.getTime() - lastResumedAt) / 1000))
    : 0;

  return Math.max(0, Math.floor(session.baseElapsedSeconds + elapsedSinceResume));
}

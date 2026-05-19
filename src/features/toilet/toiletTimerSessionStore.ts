import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
    (set) => ({
      clearSession: () => set({ session: null }),
      pauseSession: (elapsedSeconds) => set((state) => {
        if (!state.session) {
          return state;
        }

        return {
          session: {
            ...state.session,
            baseElapsedSeconds: Math.max(0, Math.floor(elapsedSeconds)),
            isPaused: true,
            lastResumedAt: null,
          },
        };
      }),
      resumeSession: () => set((state) => {
        if (!state.session) {
          return state;
        }

        return {
          session: {
            ...state.session,
            isPaused: false,
            lastResumedAt: new Date().toISOString(),
          },
        };
      }),
      session: null,
      setLiveActivityId: (activityId) => set((state) => {
        if (!state.session) {
          return state;
        }

        return {
          session: {
            ...state.session,
            liveActivityId: activityId,
          },
        };
      }),
      startSession: (startedAt) => set({
        session: {
          baseElapsedSeconds: 0,
          isPaused: false,
          lastResumedAt: startedAt,
          liveActivityId: null,
          startedAt,
        },
      }),
    }),
    {
      name: 'gangganggo-active-toilet-timer',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
      }),
    },
  ),
);

export function getActiveToiletTimerElapsedSeconds(
  session: ActiveToiletTimerSession | null,
  now = new Date(),
): number {
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

import { create } from 'zustand';

import { listHabitCheckIns, upsertHabitCheckIn } from '../../storage/repositories/habitRepository';
import { createEmptyHabitCheckIn, getLocalDateKey } from './habitLogic';
import { type HabitCheckIn, type HabitKey, type HabitLevel } from './habitTypes';

type HabitState = {
  checkIns: HabitCheckIn[];
  error: string | null;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  isHydrating: boolean;
  setHabitLevel: (date: string, key: HabitKey, level: HabitLevel) => Promise<void>;
};

export const useHabitStore = create<HabitState>((set, get) => ({
  checkIns: [],
  error: null,
  hasHydrated: false,
  hydrate: async () => {
    if (get().isHydrating || get().hasHydrated) {
      return;
    }

    set({ error: null, isHydrating: true });

    try {
      const checkIns = await listHabitCheckIns();
      set({ checkIns, hasHydrated: true, isHydrating: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '健康打卡加载失败',
        hasHydrated: true,
        isHydrating: false,
      });
    }
  },
  isHydrating: false,
  setHabitLevel: async (date, key, level) => {
    const existing = get().checkIns.find((checkIn) => checkIn.date === date) ?? createEmptyHabitCheckIn(date);
    const updated: HabitCheckIn = {
      ...existing,
      [key]: level,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      checkIns: [updated, ...state.checkIns.filter((checkIn) => checkIn.date !== date)].sort((left, right) =>
        right.date.localeCompare(left.date),
      ),
      error: null,
    }));

    try {
      await upsertHabitCheckIn(updated);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '健康打卡保存失败',
      });
    }
  },
}));

export function getHabitCheckInForDate(checkIns: HabitCheckIn[], date = getLocalDateKey()): HabitCheckIn | null {
  return checkIns.find((checkIn) => checkIn.date === date) ?? null;
}

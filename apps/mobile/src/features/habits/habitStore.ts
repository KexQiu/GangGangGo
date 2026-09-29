import { authSessionContext } from '../../api/sessionContext';
import type { LocalMutationOptions, LocalMutationResult } from '../../storage/localMutation';
import { create } from 'zustand';

import { buildLocalDateRange } from '../../storage/dateRange';
import { listHabitCheckInsPage, saveHabitLevel } from '../../storage/repositories/habitRepository';
import { notifyLocalDataChanged } from '../sync/localDataEvents';
import { getLocalDateKey } from './habitLogic';
import { type HabitCheckIn, type HabitKey, type HabitRecordLevel } from './habitTypes';

type HabitState = {
  checkIns: HabitCheckIn[];
  clearHabitLevel: (
    date: string,
    key: HabitKey,
    options?: LocalMutationOptions,
  ) => Promise<LocalMutationResult<HabitCheckIn>>;
  error: string | null;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  reset: () => void;
  isHydrating: boolean;
  setHabitLevel: (
    date: string,
    key: HabitKey,
    level: HabitRecordLevel,
    options?: LocalMutationOptions,
  ) => Promise<LocalMutationResult<HabitCheckIn>>;
};

let hydrationRevision = 0;

export const useHabitStore = create<HabitState>((set, get) => ({
  checkIns: [],
  clearHabitLevel: (date, key, options) => persistLevel(date, key, null, options),
  error: null,
  hasHydrated: false,
  reset: () => {
    hydrationRevision += 1;
    set({ error: null, hasHydrated: false, isHydrating: false, checkIns: [] });
  },
  hydrate: async () => {
    if (get().isHydrating || get().hasHydrated) {
      return;
    }

    const revision = ++hydrationRevision;
    set({ error: null, isHydrating: true });

    try {
      const range = buildLocalDateRange(30);
      const page = await listHabitCheckInsPage({
        fromDate: range.fromDate,
        limit: 30,
        toDateExclusive: range.toDateExclusive,
      });
      if (revision !== hydrationRevision) return;
      set({ checkIns: page.items, hasHydrated: true, isHydrating: false });
    } catch (error) {
      if (revision !== hydrationRevision) return;
      set({
        error: error instanceof Error ? error.message : '健康打卡加载失败',
        hasHydrated: true,
        isHydrating: false,
      });
    }
  },
  isHydrating: false,
  setHabitLevel: (date, key, level, options) => persistLevel(date, key, level, options),
}));

export function getHabitCheckInForDate(checkIns: HabitCheckIn[], date = getLocalDateKey()): HabitCheckIn | null {
  return checkIns.find((checkIn) => checkIn.date === date) ?? null;
}

async function persistLevel(
  date: string,
  key: HabitKey,
  level: HabitRecordLevel | null,
  options: LocalMutationOptions = {},
) {
  const generation = options.generation ?? authSessionContext.captureLocalGeneration();
  try {
    const result = await saveHabitLevel(date, key, level, { ...options, generation });
    if (result.status === 'saved' && authSessionContext.isGenerationCurrent(generation)) {
      useHabitStore.setState((state) => ({
        error: null,
        checkIns: [result.value, ...state.checkIns.filter((item) => item.date !== date)].sort((left, right) =>
          right.date.localeCompare(left.date),
        ),
      }));
      notifyLocalDataChanged();
    }
    return result;
  } catch (error) {
    if (authSessionContext.isGenerationCurrent(generation))
      useHabitStore.setState({ error: error instanceof Error ? error.message : '健康打卡保存失败' });
    throw error;
  }
}

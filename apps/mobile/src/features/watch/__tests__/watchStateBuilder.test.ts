import { beforeEach, expect, it, vi } from 'vitest';
import { createDefaultTrainingPreferences } from '@xiaotidu/contracts';
import { authSessionContext } from '../../../api/sessionContext';
import { buildWatchTodayState } from '../watchStateBuilder';
const state = vi.hoisted(() => ({ preferences: null as unknown, hasHydrated: true, completed: 0 }));
vi.mock('../../training/trainingPreferencesStore', () => ({ useTrainingPreferencesStore: { getState: () => state } }));
vi.mock('../../account/authStore', () => ({ useAuthStore: { getState: () => ({ accessToken: 'A' }) } }));
vi.mock('../../account/accountModel', () => ({ canAccessFeature: () => true }));
vi.mock('../../account/accountQueryService', () => ({
  getCachedCurrentUser: () => ({ id: 'A' }),
  getCachedEntitlements: () => ({}),
}));
vi.mock('../../habits/habitStore', () => ({
  getHabitCheckInForDate: () => null,
  useHabitStore: { getState: () => ({ checkIns: [] }) },
}));
vi.mock('../../training/trainingStore', () => ({
  getTodayCompletedTrainingCount: () => state.completed,
  useTrainingStore: { getState: () => ({ sessions: [] }) },
}));
vi.mock('../../toilet/toiletStore', () => ({
  getTodayToiletSessionCount: () => 0,
  useToiletStore: { getState: () => ({ sessions: [] }) },
}));
vi.mock('../../toilet/toiletTimerSessionStore', () => ({
  getActiveToiletTimerElapsedSeconds: () => 0,
  useToiletTimerSessionStore: { getState: () => ({ session: null }) },
}));
vi.mock('../watchStateRevision', () => ({ nextWatchStateRevision: () => 1 }));
beforeEach(() => {
  state.preferences = createDefaultTrainingPreferences();
  state.hasHydrated = true;
  state.completed = 1;
  authSessionContext.activate({
    generation: authSessionContext.beginTransition(),
    userId: 'A',
    profileId: 'profile-A',
    accessToken: 'A',
  });
});
it('sends actual personal parameters and only enables an explicitly chosen target', () => {
  expect(buildWatchTodayState().training).toEqual({ target: null, done: false, completedSets: 1 });
  const preferences = createDefaultTrainingPreferences();
  preferences.dailyTarget = 2;
  preferences.presets.quick = { contractSeconds: 1, relaxSeconds: 8, repetitions: 3 };
  state.preferences = preferences;
  const result = buildWatchTodayState();
  expect(result.trainingModes.find((mode) => mode.id === 'quick')).toEqual({
    id: 'quick',
    holdSeconds: 1,
    restSeconds: 8,
    rounds: 3,
  });
  expect(result.training.done).toBe(false);
  state.completed = 2;
  expect(buildWatchTodayState().training.done).toBe(true);
});
it('keeps Watch actions unavailable until the current profile configuration is loaded', () => {
  state.hasHydrated = false;
  expect(buildWatchTodayState().canUseActions).toBe(false);
  state.hasHydrated = true;
  expect(buildWatchTodayState().canUseActions).toBe(true);
});
